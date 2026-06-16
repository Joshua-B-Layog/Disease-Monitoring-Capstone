// ==========================================
// 1. IMPORT REQUIRED PACKAGES
// ==========================================
require('dotenv').config();
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
app.use(express.json());

// ==========================================
// 3. DATABASE & EMAIL CONNECTIONS
// ==========================================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log(`Connected successfully to MySQL Database: ${process.env.DB_NAME}`);
    }
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

// ROUTE: Get all users
app.get('/api/users', (req, res) => {
    db.query("SELECT * FROM users", (err, results) => {
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

// ROUTE: Delete disease case (hard delete from DB)
app.delete('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    console.log("--- Delete Case ---", { id });

    const deleteQuery = 'DELETE FROM disease_cases WHERE case_id = ?';
    
    db.query(deleteQuery, [id], (err, result) => {
        if (err) {
            console.error("Delete case error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Case not found.' });
        }
        console.log(`✅ Case ${id} deleted from database.`);
        return res.status(200).json({ message: 'Case deleted successfully.' });
    });
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// ROUTE: Login
app.post('/api/login', (req, res) => {
    const { email, password, role, context } = req.body;

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

        return res.status(200).json({
            message: 'Success',
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
                    const smsResponse = await axios.post('https://api.semaphore.co/api/v4/messages', {
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


// ROUTE: Admin-create a user account (from User Accounts panel)
app.post('/api/users', (req, res) => {
    const { firstName, lastName, username, email, mobile, barangayId, isActive, password, generateTempPassword } = req.body;

    if (!firstName || !lastName || !username || !email || !barangayId) {
        return res.status(400).json({ error: 'First name, last name, username, email, and barangay are required.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    let finalPassword = password;
    let tempPasswordGenerated = null;

    if (generateTempPassword || !password) {
        tempPasswordGenerated = crypto.randomBytes(4).toString('hex'); // 8-character temp password
        finalPassword = tempPasswordGenerated;
    }

    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, role, assigned_barangay_id, is_active)
        VALUES (?, ?, ?, ?, ?, 'BHW', ?, ?)
    `;

    db.query(insertQuery, [username, fullName, email, mobile || null, finalPassword, barangayId, isActive ? 1 : 0], (err, result) => {
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

// ROUTE: Admin-edit a user account
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, email, mobile, barangayId, isActive } = req.body;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const updateQuery = `
        UPDATE users SET
            username = ?, full_name = ?, email = ?, mobile_number = ?,
            assigned_barangay_id = ?, is_active = ?
        WHERE user_id = ?
    `;

    db.query(updateQuery, [username, fullName, email, mobile || null, barangayId, isActive ? 1 : 0, id], (err, result) => {
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
// 5. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});