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

// Verify email transporter on startup so you know immediately if credentials are wrong
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

// ROUTE: Get all disease cases
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

// ROUTE: Get list of diseases
app.get('/api/diseases', (req, res) => {
    db.query("SELECT * FROM diseases", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get list of barangays
app.get('/api/barangays', (req, res) => {
    db.query("SELECT * FROM barangays", (err, results) => {
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
// AUTHENTICATION ROUTES
// ==========================================

// ROUTE: Login
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;

    console.log("--- Login Attempt ---", { email, role });

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

        if (results.length > 0) {
            const user = results[0];
            return res.status(200).json({ 
                message: 'Success', 
                user: { id: user.user_id, name: user.full_name, role: user.role } 
            });
        } else {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// ROUTE: Register new user — matches your actual DB columns
app.post('/api/register', (req, res) => {
    const { name, email, password, role, context } = req.body;

    console.log("--- Registration Request ---", { name, email, role, context });

    // Auto-generate username from email prefix (e.g. "john@gmail.com" → "john")
    const username = email.split('@')[0];

    const insertQuery = `
        INSERT INTO users (username, full_name, email, password, role, is_active) 
        VALUES (?, ?, ?, ?, ?, 1)
    `;

    db.query(insertQuery, [username, name, email, password, role], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }
            return res.status(500).json({ message: 'Registration failed. Database error.' });
        }
        console.log("✅ New user registered:", { username, name, email, role });
        res.status(200).json({ message: 'Account registered successfully!' });
    });
});

// ==========================================
// PASSWORD RECOVERY ROUTES
// ==========================================

// ROUTE: Forgot Password — sends email link OR generates mobile OTP
app.post('/api/forgot-password', (req, res) => {
    const { identity, method } = req.body;

    // Guard: missing fields
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
            console.log("❌ No user found for:", identity);
            return res.status(404).json({ error: 'No account found with those details.' });
        }

        const userFound = results[0];
        console.log(`✅ Found user: ${userFound.username} | Email: ${userFound.email}`);

        if (method === 'email') {
            // Check email exists before trying to send
            if (!userFound.email) {
                return res.status(400).json({ error: 'This account has no email address on file.' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiryTime = new Date(Date.now() + 3600000);

            const updateTokenQuery = 'UPDATE users SET reset_token = ?, token_expiry = ? WHERE user_id = ?';
            db.query(updateTokenQuery, [token, expiryTime, userFound.user_id], (updateErr) => {
                if (updateErr) {
                    console.error("❌ Token save error:", updateErr.message);
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
                                <p style="color:#f3f4f6;font-size:16px;line-height:1.6;">
                                    We received a request to reset the password for your account.
                                </p>
                                <div style="background:#16171d;border-left:4px solid #0d9488;padding:12px 16px;margin:24px 0;border-radius:4px;">
                                    <span style="color:#9ca3af;font-size:15px;display:block;">Account:</span>
                                    <strong style="color:#f3f4f6;font-size:18px;">${userFound.full_name || userFound.username}</strong>
                                </div>
                                <p style="color:#f3f4f6;font-size:16px;">
                                    Click below to set a new password. This link expires in <strong>60 minutes</strong>.
                                </p>
                                <div style="text-align:center;margin:32px 0;">
                                    <a href="${resetLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;font-size:16px;font-weight:bold;border-radius:6px;display:inline-block;">
                                        RESET PASSWORD
                                    </a>
                                </div>
                                <p style="color:#6b7280;font-size:14px;border-top:1px solid #2e303a;padding-top:16px;margin-top:32px;">
                                    If you did not request this, ignore this email.
                                </p>
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
                        // Return the ACTUAL error so you can see it in the browser
                        return res.status(500).json({ 
                            error: 'Email failed: ' + mailErr.message 
                        });
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
            console.error("❌ OTP save error:", otpErr.message);
            return res.status(500).json({ error: 'Failed to save OTP: ' + otpErr.message });
        }

        // Check mobile number exists
        if (!userFound.mobile_number) {
            return res.status(400).json({ error: 'No mobile number on file for this account.' });
        }

        // Format PH number: convert 09xxxxxxxxx to 639xxxxxxxxx
        let mobileFormatted = userFound.mobile_number.toString().trim();
        if (mobileFormatted.startsWith('0')) {
            mobileFormatted = '63' + mobileFormatted.slice(1);
        }

        console.log(`📱 Sending OTP to: ${mobileFormatted}`);

        try {
            const smsResponse = await axios.post('https://api.semaphore.co/api/v4/messages', {
                apikey: process.env.SEMAPHORE_API_KEY,
                number: mobileFormatted,
                message: `Your Cabuyao Health System verification code is: ${generatedOtp}. Valid for 10 minutes. Do not share this code.`,
                sendername: process.env.SEMAPHORE_SENDER_NAME || 'CabuyaoCHO'
            });

            console.log(`✅ SMS sent! Response:`, smsResponse.data);

            return res.status(200).json({ 
                message: 'OTP sent to your registered mobile number.',
                routingTarget: 'mobile',
                mobileMask: `*******${userFound.mobile_number.toString().slice(-4)}`
            });

        } catch (smsErr) {
            console.error("❌ SMS send failed:", smsErr.response?.data || smsErr.message);
            // Still return success with console fallback so you can test
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

// ROUTE: Verify OTP — Login.jsx sends { identity, otp } 
app.post('/api/verify-otp', (req, res) => {
    const { identity, otp } = req.body; // ← "otp" matches what Login.jsx sends

    console.log("--- OTP Verification ---", { identity, otp });

    if (!otp || otp.length !== 6) {
        return res.status(400).json({ error: 'Please enter a valid 6-digit code.' });
    }

    const checkQuery = `
        SELECT * FROM users 
        WHERE (email = ? OR mobile_number = ? OR username = ?) 
        AND otp_code = ?
    `;

    db.query(checkQuery, [identity, identity, identity, otp], (err, results) => {
        if (err) {
            console.error("OTP check error:", err.message);
            return res.status(500).json({ error: 'Database error during OTP check.' });
        }
        if (results.length === 0) {
            return res.status(400).json({ error: 'Incorrect OTP code. Please try again.' });
        }
        console.log(`✅ OTP verified for: ${identity}`);
        return res.status(200).json({ message: 'OTP verified. You may now set a new password.' });
    });
});

// ROUTE: Reset Password via Mobile OTP flow
app.post('/api/reset-password-mobile', (req, res) => {
    const { identity, newPassword } = req.body;

    console.log("--- Mobile Password Reset ---", { identity });

    const updateQuery = `
        UPDATE users 
        SET password = ?, otp_code = NULL 
        WHERE email = ? OR mobile_number = ? OR username = ?
    `;

    db.query(updateQuery, [newPassword, identity, identity, identity], (err, result) => {
        if (err) {
            console.error("Mobile reset error:", err.message);
            return res.status(500).json({ error: 'Failed to update password.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }
        console.log(`✅ Password updated via mobile OTP for: ${identity}`);
        return res.status(200).json({ message: 'Password updated successfully!' });
    });
});

// ROUTE: Reset Password via Email Link (token-based)
app.post('/api/reset-password', (req, res) => {
    const { email, token, newPassword } = req.body;

    console.log("--- Email Token Password Reset ---", { email });

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
        db.query(clearAndSave, [newPassword, email], (updateErr, result) => {
            if (updateErr) {
                return res.status(500).json({ error: 'Failed to save new password.' });
            }
            console.log(`✅ Password reset via email link for: ${email}`);
            return res.status(200).json({ message: 'Password updated successfully!' });
        });
    });
});

// ==========================================
// 5. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});