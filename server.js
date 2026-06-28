// ==========================================
// 1. IMPORT REQUIRED PACKAGES
// ==========================================
require('dotenv').config({ path: '.env.local' });
//require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

async function sendBrevoEmail(to, subject, htmlContent) {
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'Cabuyao Health System', email: process.env.BREVO_FROM },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      }
    });
    console.log(`✅ Email sent to: ${to}`);
  } catch (err) {
    console.error('❌ Brevo API error:', err.response?.data || err.message);
    throw err;
  }
}

const app = express();

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
}));
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

db.query(`CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    push_notifications BOOLEAN DEFAULT FALSE,
    email_notifications BOOLEAN DEFAULT FALSE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    new_case_reported BOOLEAN DEFAULT FALSE,
    case_status_updated BOOLEAN DEFAULT FALSE,
    high_risk_alert BOOLEAN DEFAULT FALSE,
    weekly_summary BOOLEAN DEFAULT FALSE,
    system_maintenance BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('Error creating notification_preferences table:', err.message);
    else console.log('Notification preferences table created/verified');
});

db.query(`CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_name VARCHAR(255),
  user_role VARCHAR(50),
  cho_unit VARCHAR(100),
  barangay VARCHAR(100),
  action VARCHAR(50),
  entity VARCHAR(100),
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Error creating audit_logs table:', err.message);
  else console.log('Audit logs table created/verified');
});

function createAuditLog(userId, userName, userRole, choUnit, barangay, action, entity, details) {
  db.query(
    'INSERT INTO audit_logs (user_id, user_name, user_role, cho_unit, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId || null, userName || 'System', userRole || 'System', choUnit || null, barangay || null, action, entity, details],
    (err) => { if (err) console.error('Audit log insert error:', err.message); }
  );
}

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
ORDER BY dc.case_id DESC
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

                // Write audit log entry
                const auditUserId = req.body.user_id || null;
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                if (auditUserId) {
                  db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                    if (!uErr && uRes.length > 0) {
                      const u = uRes[0];
                      db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                        const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                        db.query(
                          'INSERT INTO audit_logs (user_id, user_name, user_role, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [auditUserId, u.full_name, u.role, brgy, 'Created', 'Case Record',
                           `Added new ${auditDisease} case for ${auditPatient} (Case ID: ${result.insertId})`],
                          (aErr) => { if (aErr) console.error('Audit log error:', aErr.message); }
                        );
                      });
                    }
                  });
                }

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
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id, 'new_case_reported');
                        
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

                // Write audit log entry
                const auditUserId = req.body.user_id || null;
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                if (auditUserId) {
                  db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                    if (!uErr && uRes.length > 0) {
                      const u = uRes[0];
                      db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                        const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                        db.query(
                          'INSERT INTO audit_logs (user_id, user_name, user_role, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
                          [auditUserId, u.full_name, u.role, brgy, 'Updated', 'Case Record',
                           `Updated ${auditDisease} case for ${auditPatient} (Case ID: ${id})`],
                          (aErr) => { if (aErr) console.error('Audit log error:', aErr.message); }
                        );
                      });
                    }
                  });
                }

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
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id, 'case_status_updated');
                        
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
    const { firstName, lastName, username, email, mobile, barangayId, isActive, role, loggedUserId } = req.body;
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
        if (loggedUserId) {
          db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [loggedUserId], (aErr, aRes) => {
            if (!aErr && aRes.length > 0) {
              const admin = aRes[0];
              const adminName = admin.full_name;
              const adminRole = admin.role;
              const choUnit = (adminRole === 'CHO') ? 'CHO Unit I' : null;
              db.query('SELECT name FROM barangays WHERE id = ?', [admin.assigned_barangay_id], (bErr, bRes) => {
                const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                createAuditLog(loggedUserId, adminName, adminRole, choUnit, brgy, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})`);
              });
            } else {
              createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})`);
            }
          });
        } else {
          createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})`);
        }
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
            
            // Write audit log entry
            const auditUserId = req.body.user_id || null;
            const auditDisease = disease_name || 'Unknown Disease';
            const auditPatient = patient_name || 'Unknown Patient';
            if (auditUserId) {
              db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                if (!uErr && uRes.length > 0) {
                  const u = uRes[0];
                  db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                    const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                    db.query(
                      'INSERT INTO audit_logs (user_id, user_name, user_role, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [auditUserId, u.full_name, u.role, brgy, 'Deleted', 'Case Record',
                       `Deleted case for ${auditPatient} (${auditDisease}) in Barangay ${barangay_name || 'N/A'} (Case ID: ${id})`],
                      (aErr) => { if (aErr) console.error('Audit log error:', aErr.message); }
                    );
                  });
                }
              });
            }

            const title = 'Case Deleted';
            const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been deleted.`;
            createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id, 'delete');

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
        createAuditLog(id, 'CHO Admin', 'CHO', null, null, 'Deleted', 'User Account', `Deleted user account ID ${id}`);
        res.status(200).json({ message: 'User deleted successfully.' });
    });
});


// ==========================================
// AUDIT LOG ROUTES
// ==========================================

// GET all audit logs (newest first)
app.get('/api/audit-logs', (req, res) => {
  db.query('SELECT * FROM audit_logs ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST a manual audit log entry (for frontend-triggered events)
app.post('/api/audit-logs', (req, res) => {
  const { user_id, user_name, user_role, cho_unit, barangay, action, entity, details } = req.body;
  db.query(
    'INSERT INTO audit_logs (user_id, user_name, user_role, cho_unit, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, user_name || 'System', user_role || 'System', cho_unit || null, barangay || null, action, entity, details],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Audit log created', id: result.insertId });
    }
  );
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

        createAuditLog(user.user_id, user.full_name, user.role, null, user.assigned_barangay_name, 'Logged In', 'System', `Login from ${device || 'Unknown Device'} at ${location || 'Unknown Location'}`);

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
    const { identity } = req.body;

    if (!identity) {
        return res.status(400).json({ error: 'Identity is required.' });
    }

    console.log(`--- Password recovery for: ${identity} ---`);

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

        if (!userFound.email) {
            return res.status(400).json({ error: 'This account has no email address on file.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiryTime = new Date(Date.now() + 3600000);

        const updateTokenQuery = 'UPDATE users SET reset_token = ?, token_expiry = ? WHERE user_id = ?';
        db.query(updateTokenQuery, [token, expiryTime, userFound.user_id], async (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ error: 'Failed to save reset token: ' + updateErr.message });
            }

            const resetLink = `http://localhost:3000/reset-password?token=${token}&email=${encodeURIComponent(userFound.email)}`;

            const mailOptions = {
                from: `"Cabuyao Health System" <${process.env.BREVO_FROM}>`,
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
            try {
                await sendBrevoEmail(mailOptions.to, mailOptions.subject, mailOptions.html);
                console.log(`✅ Email sent to: ${userFound.email}`);
                return res.status(200).json({ 
                    message: `Recovery link sent to ${userFound.email}`,
                    routingTarget: 'email'
                });
            } catch (err) {
                return res.status(500).json({ error: 'Email failed: ' + (err.response?.data || err.message) });
            }
        });
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
            sendEmail({ to: email, subject: 'Your Cabuyao Health System Account', html: `
                <div style="font-family:system-ui,sans-serif;padding:24px;">
                    <h2 style="color:#1e3a8a;">Welcome to Cabuyao Health System</h2>
                    <p>An account has been created for you as a Barangay Health Worker.</p>
                    <p><strong>Username:</strong> ${username}<br/>
                    <strong>Temporary Password:</strong> ${tempPasswordGenerated}</p>
                    <p>Please log in and change your password as soon as possible.</p>
                </div>
            ` }).catch(err => console.error('Temp password email failed:', err.message));
        }

        console.log("✅ User added:", { username, fullName, barangayId });
        createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Created', 'User Account', `Created account for ${fullName} (${role}) assigned to barangay ID ${barangayId}`);
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
            [token, expiry, userId], async (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to save verification token.' });

            const verifyLink = `http://localhost:3000/verify-2fa?token=${token}&userId=${userId}`;

            const sent = await sendEmail({ to: user.email, subject: 'Cabuyao Health — Verify Your Email for 2FA', html: `
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
            ` });
            if (!sent) return res.status(500).json({ error: 'Failed to send email.' });
            return res.status(200).json({ message: '2FA verification email sent.' });
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
            [otp, expiry, userId], async (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to generate code.' });

            const sent = await sendEmail({ to: user.email, subject: 'Cabuyao Health — Your Login Verification Code', html: `
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
            ` });
            if (!sent) {
              console.log(`\n🔑 FALLBACK LOGIN OTP for ${user.email}: [ ${otp} ]\n`);
              return res.status(200).json({ message: 'Code generated. Check server console if email failed.' });
            }
            return res.status(200).json({ message: 'Verification code sent to your email.' });
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
// TextBee SMS Gateway — free, uses Android phone as SMS gateway
async function sendSMS(to, message) {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (!apiKey || !deviceId || apiKey === 'your_textbee_api_key_here') {
        console.log(`\n[TextBee not configured] Would send SMS to ${to}: ${message}\n`);
        return;
    }
    const response = await axios.post(
        `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
        { recipients: [to], message },
        { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }
    );
    return response.data;
}

function formatPhone(phone) {
    let p = phone.toString().trim();
    if (p.startsWith('0')) p = '63' + p.slice(1);
    if (!p.startsWith('+')) p = '+' + p;
    return p;
}

// NOTIFICATIONS SYSTEM ROUTES & HELPERS
// ==========================================

// Helper function to create notification for active users with scope + preferences
function createNotificationForUsers(title, message, type, link_to, barangayId = null, eventType = null) {
    db.query('SELECT user_id, role, assigned_barangay_id, email, mobile_number FROM users WHERE is_active = 1', (err, users) => {
        if (err) {
            console.error('Error fetching active users for notifications:', err.message);
            return;
        }

        users.forEach(user => {
            // Scope: CHO must match barangay (same as BHW now)
            const isCho = user.role === 'CHO' && (barangayId === null || Number(user.assigned_barangay_id) === Number(barangayId));
            const isAssignedBhw = user.role === 'BHW' && (barangayId === null || Number(user.assigned_barangay_id) === Number(barangayId));
            
            if (!isCho && !isAssignedBhw) return;

            // Fetch this user's notification preferences
            const prefQuery = 'SELECT * FROM notification_preferences WHERE user_id = ?';
            db.query(prefQuery, [user.user_id], (prefErr, prefRows) => {
                let prefs = {
                    push_notifications: false, email_notifications: false, sms_notifications: false,
                    new_case_reported: false, case_status_updated: false, high_risk_alert: false,
                    weekly_summary: false, system_maintenance: false,
                };
                if (!prefErr && prefRows.length > 0) {
                    prefs = { ...prefs, ...prefRows[0] };
                }

                // Determine if this event is allowed by user preferences
                const eventAllowed = !eventType || eventType === 'delete' || prefs[eventType] === true;

                // 1. In-app notification (Push) — only if push_notifications is ON
                if (prefs.push_notifications && eventAllowed) {
                    db.query(
                        'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                        [user.user_id, title, message, type, link_to],
                        (insertErr) => {
                            if (insertErr) console.error(`Failed to insert notification for user ${user.user_id}:`, insertErr.message);
                        }
                    );
                }

                // 2. Email notification
                if (prefs.email_notifications && eventAllowed && user.email) {
                    const mailOptions = {
                        from: `"Cabuyao Health System" <${process.env.BREVO_FROM}>`,
                        to: user.email,
                        subject: title,
                        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                            <h2 style="color:#1e293b;margin:0 0 8px 0">${title}</h2>
                            <p style="color:#475569;font-size:15px;line-height:1.5">${message}</p>
                            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                            <p style="color:#94a3b8;font-size:12px">Cabuyao City Disease Monitoring System</p>
                        </div>`
                    };
                    sendEmail({ to: user.email, subject: mailOptions.subject, html: mailOptions.html })
                        .catch(err => console.error(`Email notification failed for user ${user.user_id}:`, err.message));
                }

                // 3. SMS notification
                if (prefs.sms_notifications && eventAllowed && user.mobile_number) {
                    const smsText = `${title}: ${message}`;
                    sendSMS(formatPhone(user.mobile_number), smsText).catch(err => {
                        console.error(`SMS notification failed for user ${user.user_id}:`, err.message);
                    });
                }
            });
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
                    createNotificationForUsers(title, message, 'high_risk', 'MapView', barangay_id, 'high_risk_alert');
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


// GET: Fetch notification preferences for a user
app.get('/api/notification-preferences/:userId', (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM notification_preferences WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.json({
                push_notifications: false, email_notifications: false, sms_notifications: false,
                new_case_reported: false, case_status_updated: false, high_risk_alert: false,
                weekly_summary: false, system_maintenance: false,
            });
        }
        return res.json(results[0]);
    });
});

// PUT: Save notification preferences for a user
app.put('/api/notification-preferences/:userId', (req, res) => {
    const { userId } = req.params;
    const {
        push_notifications, email_notifications, sms_notifications,
        new_case_reported, case_status_updated, high_risk_alert,
        weekly_summary, system_maintenance,
    } = req.body;

    db.query(
        `INSERT INTO notification_preferences 
        (user_id, push_notifications, email_notifications, sms_notifications, 
         new_case_reported, case_status_updated, high_risk_alert, 
         weekly_summary, system_maintenance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        push_notifications = VALUES(push_notifications),
        email_notifications = VALUES(email_notifications),
        sms_notifications = VALUES(sms_notifications),
        new_case_reported = VALUES(new_case_reported),
        case_status_updated = VALUES(case_status_updated),
        high_risk_alert = VALUES(high_risk_alert),
        weekly_summary = VALUES(weekly_summary),
        system_maintenance = VALUES(system_maintenance)`,
        [userId,
         push_notifications ? 1 : 0, email_notifications ? 1 : 0, sms_notifications ? 1 : 0,
         new_case_reported ? 1 : 0, case_status_updated ? 1 : 0, high_risk_alert ? 1 : 0,
         weekly_summary ? 1 : 0, system_maintenance ? 1 : 0],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            return res.json({ message: 'Preferences saved successfully' });
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