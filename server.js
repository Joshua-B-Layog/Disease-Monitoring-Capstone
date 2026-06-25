// ==========================================
// 1. IMPORT REQUIRED PACKAGES
// ==========================================
require('dotenv').config({ path: '.env.local' });
//require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json({ limit: '10mb' })); // increased for base64 photo if needed later

// ==========================================
// 3. DATABASE & EMAIL CONNECTIONS
// ==========================================
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.query('SELECT 1', (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log(`Connected successfully to MySQL Database: ${process.env.DB_NAME}`);
    }
});

db.query('CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, title VARCHAR(255), message TEXT, type VARCHAR(50), is_read TINYINT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, link_to VARCHAR(100), FOREIGN KEY (user_id) REFERENCES users(user_id))', (err) => {
    if (err) console.error('Error creating notifications table:', err.message);
    else console.log('Notifications table created/verified');
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Email transporter FAILED:", error.message);
        console.error("   Check your EMAIL_USER and EMAIL_PASS in .env");
    } else {
        console.log("✅ Email transporter ready. Emails will send successfully.");
    }
});

// ==========================================
// 4. API ROUTES
// ==========================================

// ROUTE: Get all disease cases (with disease_name join)
app.get('/api/disease_cases', (req, res) => {
    const sql = `
        SELECT 
            dc.case_id, 
            dc.patient_name,
            dc.age,
            dc.gender,
            dc.contact,
            dc.address,
            dc.symptoms,
            dc.physician,
            dc.latitude,
            dc.longitude,
            dc.onset_date,
            dc.severity,
            dc.status, 
            dc.date_reported,
            d.name AS disease_name, 
            b.name AS barangay_name,
            dc.barangay_id
        FROM disease_cases dc
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        ORDER BY dc.date_reported DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("MySQL Query Error (/api/disease_cases):", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ROUTE: Get list of diseases
app.get('/api/diseases', (req, res) => {
    db.query("SELECT * FROM diseases ORDER BY name", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get list of barangays
app.get('/api/barangays', (req, res) => {
    db.query("SELECT * FROM barangays ORDER BY name", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get all users (no passwords)
app.get('/api/users', (req, res) => {
    const query = `
        SELECT u.user_id, u.username, u.full_name, u.email, u.mobile_number,
               u.role, u.is_active, u.last_login, u.assigned_barangay_id,
               b.name AS barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        ORDER BY u.user_id ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get barangay summary reports
app.get('/api/reports', (req, res) => {
    db.query("SELECT * FROM barangay_reports", (err, results) => {
        if (err) res.status(500).send(err);
        else res.json(results);
    });
});

// ==========================================
// PROFILE ROUTES
// ==========================================

// ROUTE: Get single user profile by ID
app.get('/api/users/:id/profile', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.user_id, u.username, u.full_name, u.email, u.mobile_number,
               u.role, u.assigned_barangay_id, u.is_active,
               u.last_login, u.last_login_location, u.last_login_device,
               u.previous_login, u.previous_login_location, u.previous_login_device,
               u.two_fa_enabled,
               b.name AS assigned_barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        WHERE u.user_id = ?
    `;
    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(results[0]);
    });
});

// ROUTE: Update user profile (name, email, phone, barangay assignment)
app.put('/api/users/:id/profile', (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, mobile, assignedBarangayId } = req.body;

    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'First and last name are required.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const updateQuery = `
        UPDATE users SET
            full_name = ?,
            email = ?,
            mobile_number = ?,
            assigned_barangay_id = ?
        WHERE user_id = ?
    `;

    db.query(updateQuery, [fullName, email || null, mobile || null, assignedBarangayId || null, id], (err, result) => {
        if (err) {
            console.error('Profile update error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
        console.log(`✅ Profile updated for user ${id}: ${fullName}`);
        res.status(200).json({ message: 'Profile updated successfully.', fullName });
    });
});

// ==========================================
// CASE CRUD ROUTES
// ==========================================

// ROUTE: Add new disease case
app.post('/api/cases', (req, res) => {
    const {
        patient_name, disease_name, age, severity, gender,
        status, contact, onset_date, address, barangay_id,
        symptoms, physician, latitude, longitude
    } = req.body;

    console.log("--- Add Case ---", { patient_name, disease_name, barangay_id });

    const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
    
    db.query(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
        let diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;

        const doInsert = (dId) => {
            const insertQuery = `
                INSERT INTO disease_cases 
                (patient_name, disease_id, age, severity, gender, status, contact, 
                 onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            const vals = [
                patient_name, dId, age || null, severity, gender || 'Male',
                status || 'Active', contact || null, onset_date || null, address || null,
                barangay_id || null, symptoms || null, physician || null,
                latitude || null, longitude || null
            ];

            db.query(insertQuery, vals, (insertErr, result) => {
                if (insertErr) {
                    console.error("Insert case error:", insertErr.message);
                    return res.status(500).json({ error: insertErr.message });
                }
                console.log("✅ Case inserted, ID:", result.insertId);
                
                // Trigger auto-notifications
                db.query(`
                    SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id, dc.severity
                    FROM disease_cases dc
                    LEFT JOIN diseases d ON dc.disease_id = d.id
                    LEFT JOIN barangays b ON dc.barangay_id = b.id
                    WHERE dc.case_id = ?
                `, [result.insertId], (err, caseResults) => {
                    if (!err && caseResults && caseResults.length > 0) {
                        const caseInfo = caseResults[0];
                        const title = 'New Case Reported';
                        const message = `A new case of ${caseInfo.disease_name} (${caseInfo.severity}) has been reported for ${caseInfo.patient_name} in Barangay ${caseInfo.barangay_name || 'N/A'}.`;
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id);
                        
                        // Check for high risk
                        checkAndAlertHighRisk(caseInfo.barangay_id, caseInfo.barangay_name);
                    }
                });

                return res.status(200).json({ message: 'Case added successfully', case_id: result.insertId });
            });
        };

        if (!diseaseId && disease_name) {
            db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [disease_name], (dErr, dResult) => {
                const newId = dResult && dResult.insertId ? dResult.insertId : null;
                doInsert(newId);
            });
        } else {
            doInsert(diseaseId);
        }
    });
});

// ROUTE: Update existing case
app.put('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    const {
        patient_name, disease_name, age, severity, gender,
        status, contact, onset_date, address, barangay_id,
        symptoms, physician, latitude, longitude
    } = req.body;

    console.log("--- Update Case ---", { id, patient_name });

    const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
    
    db.query(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
        let diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;

        const doUpdate = (dId) => {
            const updateQuery = `
                UPDATE disease_cases SET
                    patient_name = ?, disease_id = ?, age = ?, severity = ?, gender = ?,
                    status = ?, contact = ?, onset_date = ?, address = ?,
                    barangay_id = ?, symptoms = ?, physician = ?,
                    latitude = ?, longitude = ?
                WHERE case_id = ?
            `;
            const vals = [
                patient_name, dId, age || null, severity, gender || 'Male',
                status, contact || null, onset_date || null, address || null,
                barangay_id || null, symptoms || null, physician || null,
                latitude || null, longitude || null, id
            ];

            db.query(updateQuery, vals, (updateErr, result) => {
                if (updateErr) {
                    console.error("Update case error:", updateErr.message);
                    return res.status(500).json({ error: updateErr.message });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Case not found.' });
                }
                console.log("✅ Case updated:", id);

                // Trigger status updated notification
                db.query(`
                    SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id, dc.status
                    FROM disease_cases dc
                    LEFT JOIN diseases d ON dc.disease_id = d.id
                    LEFT JOIN barangays b ON dc.barangay_id = b.id
                    WHERE dc.case_id = ?
                `, [id], (err, caseResults) => {
                    if (!err && caseResults && caseResults.length > 0) {
                        const caseInfo = caseResults[0];
                        const title = 'Case Status Updated';
                        const message = `The case status for ${caseInfo.patient_name} (${caseInfo.disease_name}) in Barangay ${caseInfo.barangay_name || 'N/A'} has been changed to ${caseInfo.status}.`;
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id);
                        
                        // Check for high risk
                        checkAndAlertHighRisk(caseInfo.barangay_id, caseInfo.barangay_name);
                    }
                });

                return res.status(200).json({ message: 'Case updated successfully' });
            });
        };

        if (!diseaseId && disease_name) {
            db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [disease_name], (dErr, dResult) => {
                const newId = dResult && dResult.insertId ? dResult.insertId : null;
                doUpdate(newId);
            });
        } else {
            doUpdate(diseaseId);
        }
    });
});

// ROUTE: Admin-edit a user account
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, email, mobile, barangayId, isActive, role } = req.body;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const updateQuery = `
        UPDATE users SET
            username = ?, full_name = ?, email = ?, mobile_number = ?,
            assigned_barangay_id = ?, is_active = ?, role = ?
        WHERE user_id = ?
    `;

    db.query(updateQuery, [username, fullName, email, mobile || null, barangayId, isActive ? 1 : 0, role || 'BHW', id], (err, result) => {
        if (err) {
            console.error("Update user error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'A user with this username or email already exists.' });
            }
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log("✅ User updated:", id);
        res.status(200).json({ message: 'User updated successfully.' });
    });
});


// ROUTE: Change password (verified against current password)
app.put('/api/users/:id/change-password', (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    db.query('SELECT password FROM users WHERE user_id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User not found.' });

        if (results[0].password !== currentPassword) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        db.query('UPDATE users SET password = ? WHERE user_id = ?', [newPassword, id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            return res.status(200).json({ message: 'Password updated successfully.' });
        });
    });
});




// ROUTE: Delete disease case
app.delete('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    console.log("--- Delete Case ---", { id });

    const fetchCaseQuery = `
        SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id
        FROM disease_cases dc
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        WHERE dc.case_id = ?
    `;
    
    db.query(fetchCaseQuery, [id], (err, caseResults) => {
        if (err) {
            console.error("Fetch case error before delete:", err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (!caseResults || caseResults.length === 0) {
            return res.status(404).json({ error: 'Case not found.' });
        }
        
        const caseInfo = caseResults[0];
        const { patient_name, disease_name, barangay_name, barangay_id } = caseInfo;

        const deleteQuery = 'DELETE FROM disease_cases WHERE case_id = ?';
        
        db.query(deleteQuery, [id], (delErr, delResult) => {
            if (delErr) {
                console.error("Delete case error:", delErr.message);
                return res.status(500).json({ error: delErr.message });
            }
            
            const title = 'Case Deleted';
            const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been deleted.`;
            createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id);

            console.log(`✅ Case ${id} deleted from database.`);
            return res.status(200).json({ message: 'Case deleted successfully.' });
        });
    });
});

// ROUTE: Delete a user account
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE user_id = ?', [id], (err, result) => {
        if (err) {
            console.error("Delete user error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`✅ User ${id} deleted.`);
        res.status(200).json({ message: 'User deleted successfully.' });
    });
});


// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// ROUTE: Login
app.post('/api/login', (req, res) => {
    const { email, password, role, context, device, location } = req.body;

    console.log("--- Login Attempt ---", { email, role, context });

    const query = `
        SELECT u.*, b.name AS assigned_barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        WHERE (u.username = ? OR u.email = ?)
        AND u.password = ?
        AND u.role = ?
        AND u.is_active = 1
    `;

    db.query(query, [email, email, password, role], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials or account not found.' });
        }

        const user = results[0];

        if (role === 'BHW') {
            const selectedBarangay = context.replace(/^Brgy\.\s*/i, '').trim().toLowerCase();
            const assignedBarangay = (user.assigned_barangay_name || '').trim().toLowerCase();

            if (!assignedBarangay) {
                return res.status(403).json({ 
                    error: 'Your account has no assigned barangay. Please contact your CHO administrator.' 
                });
            }

            if (selectedBarangay !== assignedBarangay) {
                return res.status(403).json({ 
                    error: `Access denied. You are assigned to Brgy. ${user.assigned_barangay_name}, not Brgy. ${context.replace(/^Brgy\.\s*/i, '').trim()}.` 
                });
            }
        }

        // Save previous login before overwriting
        const savePreviousQuery = `
            UPDATE users SET
                previous_login = last_login,
                previous_login_location = last_login_location,
                previous_login_device = last_login_device,
                last_login = NOW(),
                last_login_location = ?,
                last_login_device = ?
            WHERE user_id = ?
        `;

        db.query(savePreviousQuery, [
            location || 'Unknown Location',
            device || 'Unknown Device',
            user.user_id
        ]);

        return res.status(200).json({
            message: 'Success',
            requires2FA: !!user.two_fa_enabled,
            user: {
                id: user.user_id,
                name: user.full_name,
                role: user.role,
                barangay: user.assigned_barangay_name || null
            }
        });
    });
});

// ROUTE: Register new user
app.post('/api/register', (req, res) => {
    const { name, email, mobile, password, role, context } = req.body;

    console.log("--- Registration Request ---", { name, email, role, context });

    const username = email.split('@')[0];

    let assignedBarangayId = null;

    if (role === 'BHW' && context) {
        const parsed = parseInt(context);
        if (!isNaN(parsed)) assignedBarangayId = parsed;
    } else if (role === 'CHO' && context) {
        if (context.includes('Sala') || context.includes('Unit I')) {
            assignedBarangayId = 18;
        } else if (context.includes('Pulo') || context.includes('Unit II')) {
            assignedBarangayId = 17;
        }
    }

    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, role, assigned_barangay_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.query(insertQuery, [username, name, email, mobile || null, password, role, assignedBarangayId], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }
            return res.status(500).json({ message: 'Registration failed: ' + err.message });
        }
        console.log("✅ Registered:", { username, role, assignedBarangayId });
        res.status(200).json({ message: 'Account registered successfully!' });
    });
});

// ==========================================
// PASSWORD RECOVERY ROUTES
// ==========================================

app.post('/api/forgot-password', (req, res) => {
    const { identity, method } = req.body;

    if (!identity || !method) {
        return res.status(400).json({ error: 'Identity and method are required.' });
    }

    console.log(`--- Recovery [${method}] for: ${identity} ---`);

    const findUserQuery = 'SELECT * FROM users WHERE email = ? OR mobile_number = ? OR username = ?';
    
    db.query(findUserQuery, [identity, identity, identity], (err, results) => {
        if (err) {
            console.error("❌ DB lookup error:", err.message);
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No account found with those details.' });
        }

        const userFound = results[0];
        console.log(`✅ Found user: ${userFound.username} | Email: ${userFound.email}`);

        if (method === 'email') {
            if (!userFound.email) {
                return res.status(400).json({ error: 'This account has no email address on file.' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiryTime = new Date(Date.now() + 3600000);

            const updateTokenQuery = 'UPDATE users SET reset_token = ?, token_expiry = ? WHERE user_id = ?';
            db.query(updateTokenQuery, [token, expiryTime, userFound.user_id], (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ error: 'Failed to save reset token: ' + updateErr.message });
                }

                const resetLink = `http://localhost:5173/reset-password?token=${token}&email=${encodeURIComponent(userFound.email)}`;

                const mailOptions = {
                    from: `"Cabuyao Health System" <${process.env.EMAIL_USER}>`,
                    to: userFound.email,
                    subject: 'Cabuyao Health — Password Reset Request',
                    html: `
                        <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#16171d;border:1px solid #2e303a;border-radius:8px;overflow:hidden;">
                            <div style="background:#0d9488;padding:24px;text-align:center;">
                                <h1 style="color:#fff;margin:0;font-size:28px;">CABUYAO HEALTH</h1>
                            </div>
                            <div style="background:#1f2028;padding:40px 32px;">
                                <p style="color:#f3f4f6;font-size:16px;">We received a request to reset the password for your account.</p>
                                <div style="background:#16171d;border-left:4px solid #0d9488;padding:12px 16px;margin:24px 0;border-radius:4px;">
                                    <span style="color:#9ca3af;font-size:15px;display:block;">Account:</span>
                                    <strong style="color:#f3f4f6;font-size:18px;">${userFound.full_name || userFound.username}</strong>
                                </div>
                                <p style="color:#f3f4f6;font-size:16px;">Click below to set a new password. This link expires in <strong>60 minutes</strong>.</p>
                                <div style="text-align:center;margin:32px 0;">
                                    <a href="${resetLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;font-size:16px;font-weight:bold;border-radius:6px;display:inline-block;">RESET PASSWORD</a>
                                </div>
                                <p style="color:#6b7280;font-size:14px;border-top:1px solid #2e303a;padding-top:16px;">If you did not request this, ignore this email.</p>
                            </div>
                            <div style="background:#16171d;padding:20px;text-align:center;font-size:12px;color:#4b5563;border-top:1px solid #2e303a;">
                                © 2026 City Health Office (CHO) Cabuyao
                            </div>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (mailErr, info) => {
                    if (mailErr) {
                        console.error("❌ Email send FAILED:", mailErr.message);
                        return res.status(500).json({ error: 'Email failed: ' + mailErr.message });
                    }
                    console.log(`✅ Email sent to: ${userFound.email} | ID: ${info.messageId}`);
                    return res.status(200).json({ 
                        message: `Recovery link sent to ${userFound.email}`,
                        routingTarget: 'email'
                    });
                });
            });

        } else if (method === 'mobile') {
            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            
            const updateOtpQuery = 'UPDATE users SET otp_code = ? WHERE user_id = ?';
            db.query(updateOtpQuery, [generatedOtp, userFound.user_id], async (otpErr) => {
                if (otpErr) {
                    return res.status(500).json({ error: 'Failed to save OTP: ' + otpErr.message });
                }

                if (!userFound.mobile_number) {
                    return res.status(400).json({ error: 'No mobile number on file for this account.' });
                }

                let mobileFormatted = userFound.mobile_number.toString().trim();
                if (mobileFormatted.startsWith('0')) {
                    mobileFormatted = '63' + mobileFormatted.slice(1);
                }

                try {
                    await axios.post('https://api.semaphore.co/api/v4/messages', {
                        apikey: process.env.SEMAPHORE_API_KEY,
                        number: mobileFormatted,
                        message: `Your Cabuyao Health System verification code is: ${generatedOtp}. Valid for 10 minutes. Do not share this code.`,
                        sendername: process.env.SEMAPHORE_SENDER_NAME || 'CabuyaoCHO'
                    });

                    return res.status(200).json({ 
                        message: 'OTP sent to your registered mobile number.',
                        routingTarget: 'mobile',
                        mobileMask: `*******${userFound.mobile_number.toString().slice(-4)}`
                    });

                } catch (smsErr) {
                    console.log(`\n🔑 FALLBACK OTP for ${mobileFormatted}: [ ${generatedOtp} ]\n`);
                    return res.status(200).json({ 
                        message: 'OTP generated. Check server console if SMS failed.',
                        routingTarget: 'mobile',
                        mobileMask: `*******${userFound.mobile_number.toString().slice(-4)}`
                    });
                }
            });
        }
    });
});

app.post('/api/verify-otp', (req, res) => {
    const { identity, otp } = req.body;

    if (!otp || otp.length !== 6) {
        return res.status(400).json({ error: 'Please enter a valid 6-digit code.' });
    }

    const checkQuery = `
        SELECT * FROM users 
        WHERE (email = ? OR mobile_number = ? OR username = ?) 
        AND otp_code = ?
    `;

    db.query(checkQuery, [identity, identity, identity, otp], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error during OTP check.' });
        if (results.length === 0) return res.status(400).json({ error: 'Incorrect OTP code. Please try again.' });
        return res.status(200).json({ message: 'OTP verified. You may now set a new password.' });
    });
});

app.post('/api/reset-password-mobile', (req, res) => {
    const { identity, newPassword } = req.body;

    const updateQuery = `
        UPDATE users 
        SET password = ?, otp_code = NULL 
        WHERE email = ? OR mobile_number = ? OR username = ?
    `;

    db.query(updateQuery, [newPassword, identity, identity, identity], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed to update password.' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Account not found.' });
        return res.status(200).json({ message: 'Password updated successfully!' });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { email, token, newPassword } = req.body;

    const checkTokenQuery = `
        SELECT * FROM users 
        WHERE email = ? AND reset_token = ? AND token_expiry > NOW()
    `;

    db.query(checkTokenQuery, [email, token], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Reset link has expired or is invalid.' });
        }

        const clearAndSave = `
            UPDATE users 
            SET password = ?, reset_token = NULL, token_expiry = NULL 
            WHERE email = ?
        `;
        db.query(clearAndSave, [newPassword, email], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to save new password.' });
            return res.status(200).json({ message: 'Password updated successfully!' });
        });
    });
});

// ==========================================
// USER MANAGEMENT ROUTES (Admin panel)
// ==========================================

// ROUTE: Admin-create a user account
app.post('/api/users', (req, res) => {
    const { firstName, lastName, username, email, mobile, barangayId, isActive, password, generateTempPassword, role } = req.body;

    if (!firstName || !lastName || !username || !email || !barangayId) {
        return res.status(400).json({ error: 'First name, last name, username, email, and barangay are required.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    let finalPassword = password;
    let tempPasswordGenerated = null;

    if (generateTempPassword || !password) {
        tempPasswordGenerated = crypto.randomBytes(4).toString('hex');
        finalPassword = tempPasswordGenerated;
    }

    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, role, assigned_barangay_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [username, fullName, email, mobile || null, finalPassword, role || 'BHW', barangayId, isActive ? 1 : 0], (err, result) => {
        if (err) {
            console.error("Add user error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'A user with this username or email already exists.' });
            }
            return res.status(500).json({ error: err.message });
        }

        if (tempPasswordGenerated) {
            const mailOptions = {
                from: `"Cabuyao Health System" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Your Cabuyao Health System Account',
                html: `
                    <div style="font-family:system-ui,sans-serif;padding:24px;">
                        <h2 style="color:#1e3a8a;">Welcome to Cabuyao Health System</h2>
                        <p>An account has been created for you as a Barangay Health Worker.</p>
                        <p><strong>Username:</strong> ${username}<br/>
                        <strong>Temporary Password:</strong> ${tempPasswordGenerated}</p>
                        <p>Please log in and change your password as soon as possible.</p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) console.error("Temp password email failed:", mailErr.message);
            });
        }

        console.log("✅ User added:", { username, fullName, barangayId });
        res.status(200).json({ message: 'User account created successfully.', user_id: result.insertId, tempPassword: tempPasswordGenerated });
    });
});

// ROUTE: Send 2FA verification email — generates a real token now
app.post('/api/send-2fa-email', (req, res) => {
    const { userId } = req.body;
    db.query('SELECT email, full_name FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'User not found.' });
        const user = results[0];

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        db.query('UPDATE users SET two_fa_token = ?, two_fa_token_expiry = ? WHERE user_id = ?',
            [token, expiry, userId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to save verification token.' });

            const verifyLink = `http://localhost:5173/verify-2fa?token=${token}&userId=${userId}`;

            const mailOptions = {
                from: `"Cabuyao Health System" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: 'Cabuyao Health — Verify Your Email for 2FA',
                html: `
                    <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#16171d;border:1px solid #2e303a;border-radius:8px;overflow:hidden;">
                        <div style="background:#0d9488;padding:24px;text-align:center;">
                            <h1 style="color:#fff;margin:0;font-size:28px;">CABUYAO HEALTH</h1>
                        </div>
                        <div style="background:#1f2028;padding:40px 32px;">
                            <p style="color:#f3f4f6;font-size:16px;">Hi ${user.full_name},</p>
                            <p style="color:#f3f4f6;font-size:16px;">You requested to enable Two-Factor Authentication on your account.</p>
                            <div style="text-align:center;margin:32px 0;">
                                <a href="${verifyLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;font-size:16px;font-weight:bold;border-radius:6px;display:inline-block;">✅ Verify Email</a>
                            </div>
                            <p style="color:#6b7280;font-size:14px;border-top:1px solid #2e303a;padding-top:16px;">This link expires in 60 minutes. If you did not request this, ignore this email.</p>
                        </div>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) return res.status(500).json({ error: 'Failed to send email.' });
                return res.status(200).json({ message: '2FA verification email sent.' });
            });
        });
    });
});

// ROUTE: Confirm 2FA token from email link → activates 2FA
app.post('/api/verify-2fa-token', (req, res) => {
    const { userId, token } = req.body;

    const query = `
        SELECT * FROM users
        WHERE user_id = ? AND two_fa_token = ? AND two_fa_token_expiry > NOW()
    `;
    db.query(query, [userId, token], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (results.length === 0) {
            return res.status(400).json({ error: 'This verification link has expired or is invalid.' });
        }

        db.query(
            'UPDATE users SET two_fa_enabled = 1, two_fa_token = NULL, two_fa_token_expiry = NULL WHERE user_id = ?',
            [userId],
            (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Failed to activate 2FA.' });
                return res.status(200).json({ message: '2FA has been activated for your account.' });
            }
        );
    });
});

// ROUTE: Disable 2FA
app.post('/api/disable-2fa', (req, res) => {
    const { userId } = req.body;
    db.query('UPDATE users SET two_fa_enabled = 0, two_fa_token = NULL, two_fa_token_expiry = NULL WHERE user_id = ?',
        [userId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to disable 2FA.' });
        return res.status(200).json({ message: '2FA disabled.' });
    });
});

// ROUTE: Send login OTP (called after password is verified, only if 2FA is enabled)
app.post('/api/send-login-otp', (req, res) => {
    const { userId } = req.body;
    db.query('SELECT email, full_name FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'User not found.' });
        const user = results[0];

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 600000); // 10 minutes

        db.query('UPDATE users SET login_otp = ?, login_otp_expiry = ? WHERE user_id = ?',
            [otp, expiry, userId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to generate code.' });

            const mailOptions = {
                from: `"Cabuyao Health System" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: 'Cabuyao Health — Your Login Verification Code',
                html: `
                    <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#16171d;border:1px solid #2e303a;border-radius:8px;overflow:hidden;">
                        <div style="background:#0d9488;padding:24px;text-align:center;">
                            <h1 style="color:#fff;margin:0;font-size:28px;">CABUYAO HEALTH</h1>
                        </div>
                        <div style="background:#1f2028;padding:40px 32px;text-align:center;">
                            <p style="color:#f3f4f6;font-size:16px;">Hi ${user.full_name}, here is your login code:</p>
                            <div style="font-size:36px;font-weight:bold;color:#10b981;letter-spacing:8px;margin:24px 0;">${otp}</div>
                            <p style="color:#6b7280;font-size:14px;">This code expires in 10 minutes. If you did not attempt to log in, please secure your account.</p>
                        </div>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) {
                    console.log(`\n🔑 FALLBACK LOGIN OTP for ${user.email}: [ ${otp} ]\n`);
                    return res.status(200).json({ message: 'Code generated. Check server console if email failed.' });
                }
                return res.status(200).json({ message: 'Verification code sent to your email.' });
            });
        });
    });
});

// ROUTE: Verify login OTP — completes the 2FA login step
app.post('/api/verify-login-otp', (req, res) => {
    const { userId, otp } = req.body;

    const query = `
        SELECT * FROM users
        WHERE user_id = ? AND login_otp = ? AND login_otp_expiry > NOW()
    `;
    db.query(query, [userId, otp], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (results.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        db.query('UPDATE users SET login_otp = NULL, login_otp_expiry = NULL WHERE user_id = ?', [userId]);

        const user = results[0];
        return res.status(200).json({
            message: 'Login verified.',
            user: {
                id: user.user_id,
                name: user.full_name,
                role: user.role,
            }
        });
    });
});


// ==========================================
// NOTIFICATIONS SYSTEM ROUTES & HELPERS
// ==========================================

// Helper function to create notification for active users
function createNotificationForUsers(title, message, type, link_to, barangayId = null) {
    db.query('SELECT user_id, role, assigned_barangay_id FROM users WHERE is_active = 1', (err, users) => {
        if (err) {
            console.error('Error fetching active users for notifications:', err.message);
            return;
        }
        
        users.forEach(user => {
            const isCho = user.role === 'CHO';
            const isAssignedBhw = user.role === 'BHW' && (barangayId === null || Number(user.assigned_barangay_id) === Number(barangayId));
            
            if (isCho || isAssignedBhw) {
                db.query(
                    'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                    [user.user_id, title, message, type, link_to],
                    (insertErr) => {
                        if (insertErr) {
                            console.error(`Failed to insert notification for user ${user.user_id}:`, insertErr.message);
                        }
                    }
                );
            }
        });
    });
}

// Helper to check for high-risk status (> 20 cases)
function checkAndAlertHighRisk(barangay_id, barangay_name) {
    if (!barangay_id) return;
    
    const countQuery = `
        SELECT COUNT(*) AS count 
        FROM disease_cases 
        WHERE barangay_id = ? AND status IN ('Active', 'Under Treatment', 'Pending')
    `;
    
    db.query(countQuery, [barangay_id], (err, results) => {
        if (err || results.length === 0) return;
        const activeCount = results[0].count;
        
        if (activeCount > 20) {
            const title = '🚨 High Risk Barangay Alert';
            const message = `Barangay ${barangay_name} is now designated as High Risk with ${activeCount} active cases!`;
            
            const checkDuplicateQuery = `
                SELECT id FROM notifications 
                WHERE type = 'high_risk' AND message LIKE ? AND created_at > NOW() - INTERVAL 1 HOUR
                LIMIT 1
            `;
            db.query(checkDuplicateQuery, [`%${barangay_name}%`], (dupErr, dupResults) => {
                if (!dupErr && dupResults.length === 0) {
                    createNotificationForUsers(title, message, 'high_risk', 'MapView', barangay_id);
                }
            });
        }
    });
}

// GET: Fetch all notifications for a user
app.get('/api/notifications', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json(results);
        }
    );
});

// POST: Manually create a notification (optional but useful)
app.post('/api/notifications', (req, res) => {
    const { user_id, title, message, type, link_to } = req.body;
    db.query(
        'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
        [user_id, title, message, type || 'info', link_to || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.status(201).json({ message: 'Notification created', id: result.insertId });
        }
    );
});

// PUT: Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
    const { id } = req.params;
    db.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ?',
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'Notification marked as read' });
        }
    );
});

// DELETE: Dismiss a specific notification
app.delete('/api/notifications/:id', (req, res) => {
    const { id } = req.params;
    db.query(
        'DELETE FROM notifications WHERE id = ?',
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'Notification dismissed' });
        }
    );
});

// DELETE (bulk): Dismiss all notifications for a specific user
app.delete('/api/notifications', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    db.query(
        'DELETE FROM notifications WHERE user_id = ?',
        [userId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'All notifications dismissed' });
        }
    );
});


// ==========================================
// 5. STORAGE AND EXPORT ROUTES
// ==========================================

// GET /api/storage-stats — real counts and estimated storage usage
app.get('/api/storage-stats', (req, res) => {
  const queries = {
    cases: 'SELECT COUNT(*) AS count FROM disease_cases',
    users: 'SELECT COUNT(*) AS count FROM users',
    notifications: 'SELECT COUNT(*) AS count FROM notifications',
  };

  Promise.all([
    new Promise((resolve, reject) =>
      db.query(queries.cases, (err, r) => err ? reject(err) : resolve(r[0].count))),
    new Promise((resolve, reject) =>
      db.query(queries.users, (err, r) => err ? reject(err) : resolve(r[0].count))),
    new Promise((resolve, reject) =>
      db.query(queries.notifications, (err, r) => err ? reject(err) : resolve(r[0].count))),
  ])
  .then(([cases, users, notifications]) => {
    const caseDataKB = cases * 2;
    const userDataKB = users * 1;
    const notifKB = notifications * 0.5;
    const totalKB = caseDataKB + userDataKB + notifKB;

    res.json({
      cases,
      users,
      notifications,
      caseDataMB: (caseDataKB / 1024).toFixed(2),
      userDataMB: (userDataKB / 1024).toFixed(2),
      otherMB: (notifKB / 1024).toFixed(2),
      totalMB: (totalKB / 1024).toFixed(2),
      totalGB: (totalKB / 1024 / 1024).toFixed(3),
      maxGB: 10,
      usedPercent: Math.min(((totalKB / 1024 / 1024) / 10) * 100, 100).toFixed(1),
    });
  })
  .catch(err => res.status(500).json({ error: err.message }));
});

// GET /api/export-all — export all cases as JSON or CSV
app.get('/api/export-all', (req, res) => {
  const { format } = req.query;

  const sql = `
    SELECT dc.case_id, dc.patient_name, dc.age, dc.gender, dc.contact,
           dc.address, dc.symptoms, dc.physician, dc.onset_date,
           dc.severity, dc.status, dc.date_reported,
           dc.latitude, dc.longitude,
           d.name AS disease_name,
           b.name AS barangay_name
    FROM disease_cases dc
    LEFT JOIN diseases d ON dc.disease_id = d.id
    LEFT JOIN barangays b ON dc.barangay_id = b.id
    ORDER BY dc.date_reported DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (format === 'csv') {
      const headers = 'Case ID,Patient Name,Age,Gender,Contact,Address,' +
        'Disease,Barangay,Severity,Status,Onset Date,Date Reported\n';
      const rows = results.map(r =>
        `"${r.case_id}","${r.patient_name||''}","${r.age||''}",` +
        `"${r.gender||''}","${r.contact||''}","${r.address||''}",` +
        `"${r.disease_name||''}","${r.barangay_name||''}",` +
        `"${r.severity||''}","${r.status||''}","${r.onset_date||''}",` +
        `"${r.date_reported||''}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition',
        'attachment; filename=CDMS_Export.csv');
      return res.send(headers + rows);
    }

    res.json(results);
  });
});

// ==========================================
// 6. BACKUP AND DATA CLEAR ROUTES
// ==========================================

// GET /api/backup — full data export as JSON download
app.get('/api/backup', (req, res) => {
  const results = {};

  db.query('SELECT * FROM disease_cases', (err, cases) => {
    if (err) return res.status(500).json({ error: err.message });
    results.disease_cases = cases;

    db.query('SELECT user_id, username, full_name, role, assigned_barangay_id, is_active, email, mobile_number, last_login FROM users',
      (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      results.users = users;

      db.query('SELECT * FROM barangays', (err, barangays) => {
        if (err) return res.status(500).json({ error: err.message });
        results.barangays = barangays;

        db.query('SELECT * FROM diseases', (err, diseases) => {
          if (err) return res.status(500).json({ error: err.message });
          results.diseases = diseases;

          results.backup_date = new Date().toISOString();
          results.system = 'Cabuyao CDMS';
          results.version = '1.0';

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition',
            `attachment; filename=CDMS_Backup_${new Date().toISOString().split('T')[0]}.json`);
          res.json(results);
        });
      });
    });
  });
});

// DELETE /api/users/:id/my-data — clear current user's personal data
app.delete('/api/users/:id/my-data', (req, res) => {
  const { id } = req.params;

  db.query('SELECT assigned_barangay_id FROM users WHERE user_id = ?',
    [id], (err, userResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (userResults.length === 0)
      return res.status(404).json({ error: 'User not found.' });

    db.query('DELETE FROM notifications WHERE user_id = ?', [id],
      (err) => {
      if (err) return res.status(500).json({ error: err.message });

      console.log(`Cleared personal data for user ${id}`);
      res.status(200).json({
        message: 'Your personal data has been cleared successfully.'
      });
    });
  });
});

// ==========================================
// 7. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});