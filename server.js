// ==========================================
// 1. IMPORT REQUIRED PACKAGES
// ==========================================
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// 3. DATABASE & CARRIER CONNECTIONS
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

// Configure Nodemailer to send real emails via your Gmail credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// 4. API ROUTES
// ==========================================

// ROUTE: Get all cases for the Dashboard (With safe JOINs)
app.get('/api/disease_cases', (req, res) => {
    const sql = `
        SELECT 
            dc.case_id, 
            dc.patient_name,
            dc.age,
            d.name AS disease_name, 
            b.name AS barangay_name,
            dc.barangay_id,
            dc.severity,
            dc.status, 
            dc.date_reported 
        FROM disease_cases dc
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("MySQL Query Error (/api/disease_cases):", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ROUTE: Get list of Diseases (For Add Case dropdowns)
app.get('/api/diseases', (req, res) => {
    const sql = "SELECT * FROM diseases";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get list of Barangays (For Add Case dropdowns)
app.get('/api/barangays', (req, res) => {
    const sql = "SELECT * FROM barangays";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get all users
app.get('/api/users', (req, res) => {
    const sql = "SELECT * FROM users";
    db.query(sql, (err, results) => {
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

// ROUTE: System User Authentication
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;

    console.log("--- Login Debug ---");
    console.log("Input Received:", { email, password, role });

    const query = `
        SELECT * FROM users 
        WHERE (username = ? OR email = ?) 
        AND password = ? 
        AND role = ? 
        AND is_active = 1
    `;

    db.query(query, [email, email, password, role], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Internal server database error' });
        }

        console.log("Results found:", results.length);
        if (results.length === 0) {
            console.log("No user matched these credentials.");
        }

        if (results.length > 0) {
            const user = results[0];
            return res.status(200).json({ message: 'Success', user: { id: user.user_id, name: user.full_name, role: user.role } });
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// ROUTE: Administrative User Registration
app.post('/api/register', (req, res) => {
    const { name, mobileNumber, password, role, context } = req.body;

    console.log("--- Registration Request Received ---", { name, mobileNumber, role, context });

    const insertQuery = `
        INSERT INTO users (full_name, mobile_number, password, role, username, email, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, 1)
    `;

    const placeholderEmail = `${mobileNumber}@cabuyaohealth.gov`;
    
    db.query(insertQuery, [name, mobileNumber, password, role, mobileNumber, placeholderEmail], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            return res.status(500).json({ message: 'Registration failed. Database error.' });
        }
        res.status(200).json({ message: 'Account registered successfully!' });
    });
});

// ==========================================
// DUAL RECOVERY FLOW (MOBILE OTP OR GMAIL VERIFICATION)
// ==========================================

app.post('/api/forgot-password', (req, res) => {
    const { identity, method } = req.body; // identity: email/mobile/username, method: 'gmail' or 'mobile'

    console.log(`--- Reset Flow Initiated via [${method}] ---`);

    const findUserQuery = 'SELECT * FROM users WHERE email = ? OR mobile_number = ? OR username = ?';
    
    db.query(findUserQuery, [identity, identity, identity], (err, results) => {
        if (err) {
            console.error("Database query error:", err.message);
            return res.status(500).json({ error: 'Internal database verification failure.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No administrative account found with those details.' });
        }

        const userFound = results[0];

        // ------------------------------------------
        // METHOD A: GMAIL TRANSACTIONAL VERIFICATION LINK
        // ------------------------------------------
        if (method === 'gmail') {
            const token = crypto.randomBytes(32).toString('hex');
            const expiryTime = new Date(Date.now() + 3600000); // Valid for 1 Hour

            const updateTokenQuery = 'UPDATE users SET reset_token = ?, token_expiry = ? WHERE user_id = ?';
            db.query(updateTokenQuery, [token, expiryTime, userFound.user_id], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Failed to generate token session.' });

                const resetLink = `http://localhost:5173/reset-password?token=${token}&email=${encodeURIComponent(userFound.email)}`;

                // HTML Structure matching your custom dark-themed Newgrounds design layout
                const mailOptions = {
                    from: `"Cabuyao Health System" <${process.env.EMAIL_USER}>`,
                    to: userFound.email,
                    subject: 'Cabuyao Health Password Reset Request',
                    html: `
                        <div style="max-width: 600px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; background-color: #16171d; border: 1px solid #2e303a; border-radius: 8px; overflow: hidden; color: #9ca3af;">
                            <div style="background-color: #0d9488; padding: 24px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -0.5px;">CABUYAO HEALTH</h1>
                            </div>
                            <div style="background-color: #1f2028; padding: 40px 32px; text-align: left;">
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px; color: #f3f4f6;">
                                    This is an automated message from the <strong>Cabuyao Health Surveillance System</strong> administrative node.
                                </p>
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px; color: #f3f4f6;">
                                    We have received a system authorization request to reset the password credentials assigned to your profile.
                                </p>
                                <div style="background-color: #16171d; border-left: 4px solid #0d9488; padding: 12px 16px; margin: 24px 0; border-radius: 4px;">
                                    <span style="font-size: 15px; color: #9ca3af; display: block;">Target Administrative User:</span>
                                    <strong style="font-size: 18px; color: #f3f4f6;">${userFound.full_name || userFound.username}</strong>
                                </div>
                                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px; color: #f3f4f6;">
                                    If you initiated this verification workflow, please configure your new system access credentials by clicking the activation button below:
                                </p>
                                <div style="text-align: center; margin: 32px 0;">
                                    <a href="${resetLink}" target="_blank" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 36px; font-size: 16px; font-weight: bold; border-radius: 6px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                                        RESET PASSWORD
                                    </a>
                                </div>
                                <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-top: 32px; border-top: 1px solid #2e303a; padding-top: 16px;">
                                    This temporary verification hyperlink expires within 60 minutes. If you did not execute this validation event, you can safely disregard and delete this message.
                                </p>
                            </div>
                            <div style="background-color: #16171d; padding: 20px; text-align: center; font-size: 12px; color: #4b5563; border-top: 1px solid #2e303a;">
                                © 2026 City Health Office (CHO) Cabuyao. All database environments secured.
                            </div>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (mailErr, info) => {
                    if (mailErr) {
                        console.error("Mail Dispatch Failure:", mailErr.message);
                        return res.status(500).json({ error: 'Failed to deliver automated verification email routing.' });
                    }
                    console.log(`Email successfully dispatched to: ${userFound.email}`);
                    return res.status(200).json({ 
                        message: 'Email verification route dispatched successfully.', 
                        routingTarget: 'gmail' 
                    });
                });
            });

        // ------------------------------------------
        // METHOD B: MOBILE TELEMETRY 6-DIGIT OTP
        // ------------------------------------------
        } else if (method === 'mobile') {
            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            
            const updateOtpQuery = 'UPDATE users SET otp_code = ? WHERE user_id = ?';
            db.query(updateOtpQuery, [generatedOtp, userFound.user_id], (otpErr) => {
                if (otpErr) return res.status(500).json({ error: 'Failed to generate target verification OTP.' });

                // Presentation/Defense logs simulation window
                console.log(`\n============================================`);
                console.log(`📱 MOCK SMS DISPATCH TO: ${userFound.mobile_number}`);
                console.log(`🔑 SECURE 6-DIGIT OTP CODE: [ ${generatedOtp} ]`);
                console.log(`============================================\n`);

                return res.status(200).json({ 
                    message: 'Mobile terminal authentication coordinate generated.', 
                    routingTarget: 'mobile',
                    mobileMask: userFound.mobile_number.slice(-4)
                });
            });
        }
    });
});

// ROUTE: Verify 6-Digit Mobile Passcode
app.post('/api/verify-otp', (req, res) => {
    const { identity, otpCode } = req.body;

    const checkOtpQuery = 'SELECT * FROM users WHERE (email = ? OR mobile_number = ? OR username = ?) AND otp_code = ?';
    db.query(checkOtpQuery, [identity, identity, identity, otpCode], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database verification failure.' });
        if (results.length === 0) return res.status(400).json({ error: 'Invalid or incorrect verification OTP token.' });

        return res.status(200).json({ message: 'OTP verified successfully. Authorization token clear.' });
    });
});

// ROUTE: Save New Password and Clear Expiry Sessions
app.post('/api/reset-password', (req, res) => {
    const { email, token, newPassword } = req.body;

    console.log(`--- Database Update Initiated ---`);
    console.log(`Targeting User account: ${email}`);

    // If a token parameter exists, handle it under Email Validation expiration guidelines
    if (token) {
        const checkTokenQuery = 'SELECT * FROM users WHERE email = ? AND reset_token = ? AND token_expiry > NOW()';
        db.query(checkTokenQuery, [email, token], (err, results) => {
            if (err || results.length === 0) {
                return res.status(400).json({ error: 'Security transaction session context has expired or is invalid.' });
            }
            executePasswordChange(email, newPassword, res);
        });
    } else {
        // Direct execution fallback if matching parameters came right out of the validated OTP track
        executePasswordChange(email, newPassword, res);
    }
});

// Structural helper execution scope to commit modifications cleanly
function executePasswordChange(email, password, res) {
    const clearSessionAndSaveQuery = `
        UPDATE users 
        SET password = ?, reset_token = NULL, token_expiry = NULL, otp_code = NULL 
        WHERE email = ? OR mobile_number = ? OR username = ?
    `;
    db.query(clearSessionAndSaveQuery, [password, email, email, email], (err, result) => {
        if (err) {
            console.error("MySQL Update Query Error:", err.message);
            return res.status(500).json({ error: 'Failed to write new password credentials to database.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account index synchronization lost. Please try again.' });
        }
        console.log(`🎉 Success! Password updated in database environment for target: ${email}`);
        return res.status(200).json({ message: 'Password has been successfully updated in phpMyAdmin!' });
    });
}

// ==========================================
// 5. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});