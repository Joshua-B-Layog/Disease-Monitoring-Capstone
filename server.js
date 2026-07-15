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
const cron = require('node-cron');

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

const CHO_UNIT_BARANGAYS = {
  'CHO Unit I (Sala)': [
    'Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)',
    'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran',
  ],
  'CHO Unit II (Pulo)': [
    'Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile',
  ],
};

// Precompute barangayName -> choUnit for fast lookup
const BARANGAY_CHO_UNIT = {};
for (const [unit, barangays] of Object.entries(CHO_UNIT_BARANGAYS)) {
  barangays.forEach(b => { BARANGAY_CHO_UNIT[b.toLowerCase()] = unit; });
}

function getChoUnitForBarangay(barangayName) {
  if (!barangayName) return null;
  return BARANGAY_CHO_UNIT[barangayName.toLowerCase()] || null;
}

function detectBarangayFromAddress(address) {
  if (!address) return null;
  const addrLower = address.toLowerCase().replace(/[-\s]/g, '');
  const allBarangays = Object.values(CHO_UNIT_BARANGAYS).flat();
  const match = allBarangays.find(b => {
    const bNorm = b.replace(/\(.*?\)/g, '').toLowerCase().replace(/[-\s().]/g, '').trim();
    return addrLower.includes(bNorm);
  });
  if (match) return match;
  // Check common misspellings/aliases
  const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland', 'poblacion1': 'Barangay Uno (Poblacion)', 'poblacion 1': 'Barangay Uno (Poblacion)', 'poblacion2': 'Barangay Dos (Poblacion)', 'poblacion 2': 'Barangay Dos (Poblacion)', 'poblacion3': 'Barangay Tres (Poblacion)', 'poblacion 3': 'Barangay Tres (Poblacion)' };
  for (const [alias, barangay] of Object.entries(BARANGAY_ALIASES)) {
    if (addrLower.includes(alias)) return barangay;
  }
  return null;
}

function getChoUnitForBarangayName(barangayName) {
  for (const [unit, list] of Object.entries(CHO_UNIT_BARANGAYS)) {
    if (list.some(b => b.toLowerCase() === (barangayName || '').toLowerCase())) return unit;
  }
  return null;
}

function isSameBarangay(name1, name2) {
  if (!name1 || !name2) return false;
  const norm = (s) => s.toLowerCase().replace(/[\s\-().]/g, '');
  return norm(name1) === norm(name2);
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

// Add initial_password column to users table if missing (migration for existing DBs)
db.query("SHOW COLUMNS FROM users LIKE 'initial_password'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE users ADD COLUMN initial_password VARCHAR(255) DEFAULT NULL AFTER password", (alterErr) => {
            if (alterErr) console.error('Migration error adding initial_password:', alterErr.message);
            else console.log('Migration: added initial_password column to users table');
        });
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


db.query(`CREATE TABLE IF NOT EXISTS generated_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  period VARCHAR(50),
  entity VARCHAR(100),
  details TEXT,
  cho_unit VARCHAR(100),
  snapshot_logs LONGTEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Error creating generated_reports table:', err.message);
  else console.log('Generated reports table created/verified');
});

db.query(`CREATE TABLE IF NOT EXISTS case_inbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  from_user_id INT,
  from_user_name VARCHAR(255),
  from_cho_unit VARCHAR(100),
  to_cho_unit VARCHAR(100),
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (case_id) REFERENCES disease_cases(case_id) ON DELETE CASCADE
)`, (err) => {
  if (err) console.error('Error creating case_inbox table:', err.message);
  else console.log('Case inbox table created/verified');
});

db.query(`CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  target_cho_unit VARCHAR(100),
  disease_name VARCHAR(255),
  message TEXT NOT NULL,
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Error creating contact_messages table:', err.message);
  else console.log('Contact messages table created/verified');
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

// ROUTE: Lookup patient by name/surname for auto-fill
app.get('/api/patients/lookup', (req, res) => {
  const { name } = req.query;
  if (!name || name.trim().length < 2) {
    return res.json([]);
  }
  const searchTerm = `%${name.trim()}%`;
  const sql = `
    SELECT dc1.patient_name, dc1.age, dc1.gender, dc1.contact,
           dc1.address, dc1.barangay_id, b.name AS barangay_name,
           dc1.symptoms, dc1.physician, dc1.latitude, dc1.longitude,
           dc1.date_reported
    FROM disease_cases dc1
    LEFT JOIN barangays b ON dc1.barangay_id = b.id
    INNER JOIN (
      SELECT patient_name, MAX(date_reported) AS max_date
      FROM disease_cases
      WHERE patient_name LIKE ?
      GROUP BY patient_name
    ) dc2 ON dc1.patient_name = dc2.patient_name AND dc1.date_reported = dc2.max_date
    ORDER BY dc1.date_reported DESC
    LIMIT 10
  `;
  db.query(sql, [searchTerm], (err, results) => {
    if (err) {
      console.error("Patient lookup error:", err.message);
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

    // ── Duplicate active case check ──
    const activeStatuses = ['Active', 'Under Treatment', 'Pending'];
    const checkDuplicate = (callback) => {
        if (!patient_name || status === 'Draft') return callback();
        db.query(
            'SELECT case_id, status FROM disease_cases WHERE patient_name LIKE ? AND status IN (?, ?, ?) LIMIT 1',
            [patient_name, 'Active', 'Under Treatment', 'Pending'],
            (dupErr, dupResults) => {
                if (dupErr) {
                    console.error("Duplicate check error:", dupErr.message);
                    return res.status(500).json({ error: dupErr.message });
                }
                if (dupResults && dupResults.length > 0) {
                    return res.status(409).json({
                        error: `Patient "${patient_name}" already has an active case (Status: ${dupResults[0].status}). Please resolve the existing case before adding a new one.`
                    });
                }
                callback();
            }
        );
    };

    const detectedBarangay = detectBarangayFromAddress(address);
    const submitterChoUnit = req.body.submitter_cho_unit || null;
    const submitterRole = req.body.submitter_role || null;
    const submitterOwnBarangay = req.body.submitter_own_barangay || null;
    console.log("🔍 detectBarangayFromAddress:", JSON.stringify({ address, detectedBarangay, submitterChoUnit, submitterRole }));

    function routeOrProceed(selectedBarangayName) {
      console.log("🔍 routeOrProceed:", JSON.stringify({ detectedBarangay, selectedBarangayName, submitterChoUnit, submitterRole, barangay_id }));
      if (detectedBarangay && submitterChoUnit) {
        const targetUnit = getChoUnitForBarangayName(detectedBarangay);
        console.log("🔍 Cross-unit check:", JSON.stringify({ targetUnit, submitterChoUnit, mismatch: targetUnit !== submitterChoUnit }));

        if (submitterRole === 'BHW') {
          if (submitterOwnBarangay && isSameBarangay(detectedBarangay, submitterOwnBarangay)) {
            // detected barangay matches BHW's own assignment, no routing needed
            return proceedAfterCrossCheck();
          } else if (targetUnit === submitterChoUnit) {
            return res.status(409).json({
              crossBarangay: true,
              detectedBarangay,
              targetUnit,
              message: `This address belongs to Barangay ${detectedBarangay}. Do you want to send this case to the ${detectedBarangay} BHW?`
            });
          } else if (targetUnit && targetUnit !== submitterChoUnit) {
            return res.status(409).json({
              crossUnit: true,
              detectedBarangay,
              targetUnit,
              message: `This is a ${targetUnit} address. Do you want to put it on the inbox to send it to ${targetUnit}?`
            });
          }
        } else if (targetUnit && targetUnit !== submitterChoUnit) {
          return res.status(409).json({
            crossUnit: true,
            detectedBarangay,
            targetUnit,
            message: `This is a ${targetUnit} address. Do you want to put it on the inbox to send it to ${targetUnit}?`
          });
        }
      }

      if (!barangay_id && !detectedBarangay) {
        return res.status(400).json({ error: 'Please select an assigned barangay before saving.' });
      }

      proceedAfterCrossCheck();
    }

    if (barangay_id) {
      db.query('SELECT name FROM barangays WHERE id = ?', [barangay_id], (bErr, bRes) => {
        if (bErr) return res.status(500).json({ error: bErr.message });
        const selectedName = bRes.length > 0 ? bRes[0].name : null;
        routeOrProceed(selectedName);
      });
    } else {
      routeOrProceed(null);
    }
    function proceedAfterCrossCheck() {
      if (contact && contact.trim()) {
        db.query('SELECT case_id FROM disease_cases WHERE contact = ? AND contact IS NOT NULL AND contact != ? AND patient_name != ? LIMIT 1', [contact.trim(), '', patient_name], (cErr, cRes) => {
          if (cErr) return res.status(500).json({ error: cErr.message });
          if (cRes && cRes.length > 0) {
            return res.status(409).json({ error: 'That contact number is already in use by another patient. Please use a different contact number.' });
          }
          proceedToCheck();
        });
      } else {
        proceedToCheck();
      }
    }

    function proceedToCheck() {
    checkDuplicate(() => {
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
                patient_name, dId, age || 0, severity, gender || 'Male',
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
                const auditUserId = (req.body && req.body.user_id) || null;
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
}
});

// ROUTE: Route case to inbox (cross-unit) — stores all case data in case_inbox, no disease_cases entry yet
app.post('/api/cases/route-to-inbox', (req, res) => {
    const {
        patient_name, disease_name, age, severity, gender, status, contact,
        onset_date, address, symptoms, physician, latitude, longitude,
        submitter_user_id, submitter_name, from_cho_unit, to_cho_unit, notes
    } = req.body;

    db.query(
        `INSERT INTO case_inbox
        (case_id, from_user_id, from_user_name, from_cho_unit, to_cho_unit, status, notes,
         patient_name, disease_name, age, severity, gender, contact,
         onset_date, address, symptoms, physician, latitude, longitude)
        VALUES (NULL, ?, ?, ?, ?, 'pending', ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?)`,
        [submitter_user_id || null, submitter_name || 'Unknown', from_cho_unit, to_cho_unit, notes || null,
         patient_name, disease_name || '', age || 0, severity, gender || 'Male', contact || null,
         onset_date || null, address || null, symptoms || null, physician || null,
         latitude || null, longitude || null],
        (inboxErr, inboxResult) => {
            if (inboxErr) {
                console.error('route-to-inbox insert error:', inboxErr.message);
                return res.status(500).json({ error: inboxErr.message });
            }
            // Detect target barangay from address for scoped notification
            const detectedBrgy = detectBarangayFromAddress(address || '');
            const doNotify = (brgyId) => {
                createNotificationForUsers(
                    'New Case Reported',
                    `${submitter_name || 'A user'} from ${from_cho_unit} sent a case needing assignment: ${patient_name} (${disease_name}).`,
                    'info', 'Inbox', brgyId, 'new_case_reported', to_cho_unit
                );
            };
            if (detectedBrgy) {
                db.query('SELECT id FROM barangays WHERE LOWER(name) = LOWER(?)', [detectedBrgy], (bErr, bRes) => {
                    doNotify(!bErr && bRes && bRes.length > 0 ? bRes[0].id : null);
                });
            } else {
                doNotify(null);
            }
            res.status(200).json({ message: 'Case routed to inbox successfully.', inbox_id: inboxResult.insertId });
        }
    );
});

app.post('/api/cases/route-to-barangay-inbox', (req, res) => {
    const {
        patient_name, disease_name, age, severity, gender, status, contact,
        onset_date, address, symptoms, physician, latitude, longitude,
        submitter_user_id, submitter_name, from_cho_unit, target_barangay_name, notes
    } = req.body;

    db.query('SELECT id FROM barangays WHERE LOWER(name) = LOWER(?)', [target_barangay_name], (bErr, bResults) => {
        if (bErr) return res.status(500).json({ error: bErr.message });
        if (!bResults || bResults.length === 0) {
            return res.status(400).json({ error: 'Target barangay not found.' });
        }
        const targetBarangayId = bResults[0].id;

        const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
        db.query(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
            const diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;
            db.query(
                `INSERT INTO disease_cases
                (patient_name, disease_id, age, severity, gender, status, contact,
                 onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW())`,
                [patient_name, diseaseId, age || 0, severity, gender || 'Male', status || 'Pending',
                 contact || null, onset_date || null, address || null, symptoms || null,
                 physician || null, latitude || null, longitude || null],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error('route-to-barangay-inbox insert error:', insertErr.message);
                        return res.status(500).json({ error: insertErr.message });
                    }
                    const caseId = result.insertId;
                    db.query(
                        'INSERT INTO case_inbox (case_id, from_user_id, from_user_name, from_cho_unit, to_barangay_id, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [caseId, submitter_user_id || null, submitter_name || 'Unknown', from_cho_unit || null, targetBarangayId, 'pending'],
                        (inboxErr, inboxResult) => {
                            if (inboxErr) {
                                console.error('case_inbox insert error:', inboxErr.message);
                                return res.status(500).json({ error: inboxErr.message });
                            }
                            const msg = notes
                                ? `${submitter_name || 'A BHW'} sent you a case needing your review: ${patient_name} (${disease_name}). Note: "${notes}"`
                                : `${submitter_name || 'A BHW'} sent you a case needing your review: ${patient_name} (${disease_name}).`;
                            createNotificationForUsers(
                                'New Case Reported',
                                msg,
                                'info', 'Inbox', targetBarangayId, 'new_case_reported'
                            );
                            res.status(200).json({ message: 'Case routed to barangay inbox successfully.', case_id: caseId, inbox_id: inboxResult.insertId });
                        }
                    );
                }
            );
        });
    });
});

// GET inbox items for a CHO unit
app.get('/api/case-inbox', (req, res) => {
    const { cho_unit, barangay_id, status } = req.query;
    let sql = `
    SELECT ci.*,
      COALESCE(ci.patient_name, dc.patient_name) AS patient_name,
      COALESCE(ci.disease_name, d.name) AS disease_name,
      COALESCE(ci.severity, dc.severity) AS severity,
      COALESCE(ci.age, dc.age) AS age,
      COALESCE(ci.gender, dc.gender) AS gender,
      COALESCE(ci.contact, dc.contact) AS contact,
      COALESCE(ci.onset_date, dc.onset_date) AS onset_date,
      COALESCE(ci.address, dc.address) AS address,
      COALESCE(ci.symptoms, dc.symptoms) AS symptoms,
      COALESCE(ci.physician, dc.physician) AS physician,
      COALESCE(ci.latitude, dc.latitude) AS latitude,
      COALESCE(ci.longitude, dc.longitude) AS longitude,
      dc.status AS case_status, dc.date_reported,
      b.name AS to_barangay_name,
      u.role AS from_user_role,
      ub.name AS from_sender_barangay_name
    FROM case_inbox ci
    LEFT JOIN disease_cases dc ON ci.case_id = dc.case_id
    LEFT JOIN diseases d ON dc.disease_id = d.id
    LEFT JOIN barangays b ON ci.to_barangay_id = b.id
    LEFT JOIN users u ON ci.from_user_id = u.user_id
    LEFT JOIN barangays ub ON u.assigned_barangay_id = ub.id
    WHERE 1=1
    `;
    const params = [];
    if (barangay_id) {
        sql += ' AND ci.to_barangay_id = ?';
        params.push(barangay_id);
    } else if (cho_unit) {
        sql += ' AND ci.to_cho_unit = ?';
        params.push(cho_unit);
    }
    if (status) { sql += ' AND ci.status = ?'; params.push(status); }
    sql += ' ORDER BY ci.created_at DESC';
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// GET outbox items sent BY a CHO unit
app.get('/api/case-outbox', (req, res) => {
    const { cho_unit, barangay, user_id } = req.query;
    if (!cho_unit) return res.status(400).json({ error: 'cho_unit is required.' });
    const unitBarangays = CHO_UNIT_BARANGAYS[cho_unit] || [];
    let sql;
    let params;
    if (barangay && user_id) {
        // BHW: match by from_user_id (sent) or target barangay (received)
        sql = `
        SELECT ci.*,
          COALESCE(ci.patient_name, dc.patient_name) AS patient_name,
          COALESCE(ci.disease_name, d.name) AS disease_name,
          COALESCE(ci.severity, dc.severity) AS severity,
          COALESCE(ci.age, dc.age) AS age,
          COALESCE(ci.gender, dc.gender) AS gender,
          COALESCE(ci.contact, dc.contact) AS contact,
          COALESCE(ci.onset_date, dc.onset_date) AS onset_date,
          COALESCE(ci.address, dc.address) AS address,
          COALESCE(ci.symptoms, dc.symptoms) AS symptoms,
          COALESCE(ci.physician, dc.physician) AS physician,
          COALESCE(ci.latitude, dc.latitude) AS latitude,
          COALESCE(ci.longitude, dc.longitude) AS longitude,
          dc.status AS case_status, dc.date_reported, dc.barangay_id,
          b.name AS barangay_name,
          tb.name AS to_barangay_name,
          ub.name AS from_barangay_name,
          CASE WHEN ci.from_user_id = ? THEN 'sent' ELSE 'received' END AS direction
        FROM case_inbox ci
        LEFT JOIN disease_cases dc ON ci.case_id = dc.case_id
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        LEFT JOIN barangays tb ON ci.to_barangay_id = tb.id
        LEFT JOIN users u ON ci.from_user_id = u.user_id
        LEFT JOIN barangays ub ON u.assigned_barangay_id = ub.id
        WHERE (ci.from_user_id = ? OR tb.name = ?)
        `;
        params = [user_id, user_id, barangay];
    } else {
        // CHO: match by from_cho_unit, to_cho_unit, or unit barangays
        sql = `
        SELECT ci.*,
          COALESCE(ci.patient_name, dc.patient_name) AS patient_name,
          COALESCE(ci.disease_name, d.name) AS disease_name,
          COALESCE(ci.severity, dc.severity) AS severity,
          COALESCE(ci.age, dc.age) AS age,
          COALESCE(ci.gender, dc.gender) AS gender,
          COALESCE(ci.contact, dc.contact) AS contact,
          COALESCE(ci.onset_date, dc.onset_date) AS onset_date,
          COALESCE(ci.address, dc.address) AS address,
          COALESCE(ci.symptoms, dc.symptoms) AS symptoms,
          COALESCE(ci.physician, dc.physician) AS physician,
          COALESCE(ci.latitude, dc.latitude) AS latitude,
          COALESCE(ci.longitude, dc.longitude) AS longitude,
          dc.status AS case_status, dc.date_reported, dc.barangay_id,
          b.name AS barangay_name,
          tb.name AS to_barangay_name,
          ub.name AS from_barangay_name,
          CASE WHEN ci.from_cho_unit = ? THEN 'sent' ELSE 'received' END AS direction
        FROM case_inbox ci
        LEFT JOIN disease_cases dc ON ci.case_id = dc.case_id
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        LEFT JOIN barangays tb ON ci.to_barangay_id = tb.id
        LEFT JOIN users u ON ci.from_user_id = u.user_id
        LEFT JOIN barangays ub ON u.assigned_barangay_id = ub.id
        WHERE (ci.from_cho_unit = ? OR ci.to_cho_unit = ?)
        `;
        params = [cho_unit, cho_unit, cho_unit];
        if (unitBarangays.length > 0) {
            const placeholders = unitBarangays.map(() => '?').join(',');
            sql += ` OR tb.name IN (${placeholders})`;
            params.push(...unitBarangays);
        }
    }
    sql += ' ORDER BY ci.created_at DESC';
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Accept: create disease_cases entry from inbox data, then mark accepted
app.put('/api/case-inbox/:id/accept', (req, res) => {
    const { id } = req.params;
    db.query(
        'SELECT * FROM case_inbox WHERE id = ?',
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows.length === 0) return res.status(404).json({ error: 'Inbox item not found.' });
            const item = rows[0];

            const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
            db.query(findDiseaseQuery, [item.disease_name], (dErr, dRes) => {
                const diseaseId = dRes && dRes.length > 0 ? dRes[0].id : null;
                db.query(
                    `INSERT INTO disease_cases
                    (patient_name, disease_id, age, severity, gender, status, contact,
                     onset_date, address, symptoms, physician, latitude, longitude, date_reported)
                    VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [item.patient_name, diseaseId, item.age || 0, item.severity, item.gender || 'Male',
                     item.contact || null, item.onset_date || null, item.address || null,
                     item.symptoms || null, item.physician || null, item.latitude || null, item.longitude || null],
                    (insertErr, result) => {
                        if (insertErr) {
                            console.error('Accept insert error:', insertErr.message);
                            return res.status(500).json({ error: insertErr.message });
                        }
                        const caseId = result.insertId;
                        db.query(
                            "UPDATE case_inbox SET case_id = ?, status = 'accepted', resolved_at = NOW() WHERE id = ?",
                            [caseId, id],
                            (updateErr) => {
                                if (updateErr) {
                                    console.error('Accept update error:', updateErr.message);
                                    return res.status(500).json({ error: updateErr.message });
                                }
                                res.json({ message: 'Case accepted.', case_id: caseId });
                            }
                        );
                    }
                );
            });
        }
    );
});

// Reject: mark inbox item rejected
app.put('/api/case-inbox/:id/reject', (req, res) => {
    const { id } = req.params;
    db.query(
        "UPDATE case_inbox SET status = 'rejected', resolved_at = NOW() WHERE id = ?",
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Inbox item not found.' });
            res.json({ message: 'Case rejected.' });
        }
    );
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
                patient_name, dId, age || 0, severity, gender || 'Male',
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
                const auditUserId = (req.body && req.body.user_id) || null;
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

        if (contact && contact.trim()) {
          db.query('SELECT case_id FROM disease_cases WHERE contact = ? AND contact IS NOT NULL AND contact != ? AND case_id != ? AND patient_name != ? LIMIT 1', [contact.trim(), '', id, patient_name], (cErr, cRes) => {
            if (cErr) return res.status(500).json({ error: cErr.message });
            if (cRes && cRes.length > 0) {
              return res.status(409).json({ error: 'That contact number is already in use by another patient. Please use a different contact number.' });
            }
            proceedToUpdate();
          });
        } else {
          proceedToUpdate();
        }

        function proceedToUpdate() {
        if (!diseaseId && disease_name) {
            db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [disease_name], (dErr, dResult) => {
                const newId = dResult && dResult.insertId ? dResult.insertId : null;
                doUpdate(newId);
            });
        } else {
            doUpdate(diseaseId);
        }
        }
    });
});

// ROUTE: Admin-edit a user account
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, email, mobile, barangayId, isActive, role, loggedUserId } = req.body;
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    // Check for duplicates excluding current user
    const checkDupEditQuery = `
        SELECT
            SUM(username = ? AND user_id != ?) AS username_count,
            SUM(email = ? AND user_id != ?) AS email_count,
            SUM(mobile_number = ? AND user_id != ? AND ? != '' AND ? IS NOT NULL) AS mobile_count
        FROM users
    `;

    const dupEditResult = await new Promise((resolve, reject) => {
        db.query(checkDupEditQuery, [
            username, id,
            email, id,
            mobile || '', id, mobile || '', mobile || ''
        ], (err, rows) => {
            if (err) reject(err);
            else resolve(rows[0]);
        });
    });

    if (dupEditResult.username_count > 0) {
        return res.status(409).json({ error: 'A user with this username already exists.' });
    }
    if (dupEditResult.email_count > 0) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (mobile && dupEditResult.mobile_count > 0) {
        return res.status(409).json({ error: 'A user with this contact number already exists.' });
    }

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
            const auditUserId = (req.body && req.body.user_id) || null;
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
// GENERATED REPORTS ROUTES
// ==========================================

// GET all generated reports (newest first), optionally filtered by cho_unit
app.get('/api/generated-reports', (req, res) => {
  const { cho_unit } = req.query;
  let sql = 'SELECT * FROM generated_reports';
  const params = [];

  if (cho_unit) {
    sql += ' WHERE cho_unit = ?';
    params.push(cho_unit);
  }

  sql += ' ORDER BY created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    // Parse snapshot_logs back into an array for the frontend
    const parsed = results.map(r => ({
      ...r,
      snapshotLogs:
    typeof r.snapshot_logs === "string"
        ? JSON.parse(r.snapshot_logs)
        : (r.snapshot_logs || [])
    }));
    res.json(parsed);
  });
});

// POST a new generated report
app.post('/api/generated-reports', (req, res) => {
  const { title, period, entity, details, cho_unit, snapshotLogs, created_by } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Report title is required.' });
  }

  const sql = `
    INSERT INTO generated_reports (title, period, entity, details, cho_unit, snapshot_logs, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const vals = [
    title,
    period || null,
    entity || null,
    details || null,
    cho_unit || null,
    JSON.stringify(snapshotLogs || []),
    created_by || null
  ];

  db.query(sql, vals, (err, result) => {
    if (err) {
      console.error('Error creating generated report:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ message: 'Report generated successfully', id: result.insertId });
  });
});

// DELETE a generated report
app.delete('/api/generated-reports/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM generated_reports WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    res.json({ message: 'Report deleted successfully' });
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

        if (role === 'CHO') {
            const selectedUnit = context;

            const allowedBarangays = CHO_UNIT_BARANGAYS[selectedUnit] || [];
            const assignedBarangay = (user.assigned_barangay_name || '').trim().toLowerCase();

            if (!assignedBarangay) {
                return res.status(403).json({
                    error: 'Your account has no assigned barangay. Please contact your administrator.'
                });
            }

            if (!allowedBarangays.some(b => b.toLowerCase() === assignedBarangay)) {
                const userUnit = Object.entries(CHO_UNIT_BARANGAYS).find(([, list]) =>
                    list.includes(assignedBarangay)
                )?.[0] || 'another unit';
                return res.status(403).json({
                    error: `Access denied. You belong to ${userUnit}, not ${selectedUnit}.`
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
    const { name, username: bodyUsername, email, mobile, password, role, context } = req.body;
    const enforcedRole = 'BHW'; // Public self-registration is BHW-only. CHO accounts must be created via User Management by an existing CHO admin.

    console.log("--- Registration Request ---", { name, email, role: enforcedRole, context });

    const username = bodyUsername || email.split('@')[0];

    let assignedBarangayId = null;

    if (context) {
        const parsed = parseInt(context);
        if (!isNaN(parsed)) assignedBarangayId = parsed;
    }

    // Duplicate-username check
    const checkUsernameQuery = 'SELECT user_id FROM users WHERE username = ?';
    db.query(checkUsernameQuery, [username], (err, rows) => {
        if (err) {
            console.error("Username check error:", err.message);
            return res.status(500).json({ message: 'Registration failed: ' + err.message });
        }
        if (rows.length > 0) {
            return res.status(409).json({ message: 'This username is already taken.' });
        }

    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, initial_password, role, assigned_barangay_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.query(insertQuery, [username, name, email, mobile || null, password, password, enforcedRole, assignedBarangayId], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }
            return res.status(500).json({ message: 'Registration failed: ' + err.message });
        }
        console.log("✅ Registered:", { username, role: enforcedRole, assignedBarangayId });
        res.status(200).json({ message: 'Account registered successfully!' });
    });
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
app.post('/api/users', async (req, res) => {
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

    // Check for duplicates before inserting
    const checkDuplicateQuery = `
        SELECT
            SUM(username = ?) AS username_count,
            SUM(email = ?) AS email_count,
            SUM(mobile_number = ? AND ? != '' AND ? IS NOT NULL) AS mobile_count
        FROM users
    `;

    const dupResult = await new Promise((resolve, reject) => {
        db.query(checkDuplicateQuery, [username, email, mobile || '', mobile || '', mobile || ''], (err, rows) => {
            if (err) reject(err);
            else resolve(rows[0]);
        });
    });

    if (dupResult.username_count > 0) {
        return res.status(409).json({ error: 'A user with this username already exists.' });
    }
    if (dupResult.email_count > 0) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (mobile && dupResult.mobile_count > 0) {
        return res.status(409).json({ error: 'A user with this contact number already exists.' });
    }

    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, initial_password, role, assigned_barangay_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [username, fullName, email, mobile || null, finalPassword, finalPassword, role || 'BHW', barangayId, isActive ? 1 : 0], (err, result) => {
        if (err) {
            console.error("Add user error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'A user with this username or email already exists.' });
            }
            return res.status(500).json({ error: err.message });
        }

        if (tempPasswordGenerated) {
            sendBrevoEmail(email, 'Your Cabuyao Health System Account', `
                <div style="font-family:system-ui,sans-serif;padding:24px;">
                    <h2 style="color:#1e3a8a;">Welcome to Cabuyao Health System</h2>
                    <p>An account has been created for you as a Barangay Health Worker.</p>
                    <p><strong>Username:</strong> ${username}<br/>
                    <strong>Temporary Password:</strong> ${tempPasswordGenerated}</p>
                    <p>Please log in and change your password as soon as possible.</p>
                </div>
            `).catch(err => console.error('Temp password email failed:', err.message));
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

            try {
                await sendBrevoEmail(user.email, 'Cabuyao Health — Verify Your Email for 2FA', `
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
                `);
            } catch (err) {
                return res.status(500).json({ error: 'Failed to send email.' });
            }
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

            try {
                await sendBrevoEmail(user.email, 'Cabuyao Health — Your Login Verification Code', `
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
                `);
                return res.status(200).json({ message: 'Verification code sent to your email.' });
            } catch (err) {
                console.log(`\n🔑 FALLBACK LOGIN OTP for ${user.email}: [ ${otp} ]\n`);
                return res.status(200).json({ message: 'Code generated. Check server console if email failed.' });
            }
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
// Brevo SMS Gateway
async function sendSMS(to, message) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.log(`\n[Brevo SMS not configured] Would send SMS to ${to}: ${message}\n`);
        return;
    }
    await axios.post('https://api.brevo.com/v3/transactionalSMS/sms', {
        sender: 'Cabuyao',
        recipient: to,
        content: message,
        type: 'transactional'
    }, {
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
    });
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
function createNotificationForUsers(title, message, type, link_to, barangayId = null, eventType = null, choUnit = null) {

    // Pre-fetch the CHO unit for the case barangay (for unit-level CHO matching)
    const proceed = (caseBarangayUnit) => {
        db.query(
            `SELECT u.user_id, u.role, u.assigned_barangay_id, u.email, u.mobile_number, b.name AS barangay_name
             FROM users u
             LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
             WHERE u.is_active = 1`,
            (err, users) => {
            if (err) {
                console.error('Error fetching active users for notifications:', err.message);
                return;
            }

            users.forEach(user => {
                // If choUnit is provided, only notify users whose barangay belongs to that unit
                if (choUnit) {
                    const unitBarangays = CHO_UNIT_BARANGAYS[choUnit] || [];
                    const userBelongsToUnit = user.barangay_name && unitBarangays.some(b => b.toLowerCase() === user.barangay_name.toLowerCase());
                    if (!userBelongsToUnit) return;
                }

                // When choUnit is provided and no specific barangay, only notify CHO (skip BHW)
                // When both choUnit and barangayId are provided, BHW assigned to that barangay also get notified
                if (choUnit && user.role === 'BHW' && barangayId === null) return;

                // ── UNIT-AWARE CHO MATCHING ──
                // For BHW: still exact barangay match
                const isAssignedBhw = user.role === 'BHW' && (barangayId === null || Number(user.assigned_barangay_id) === Number(barangayId));

                // For CHO: exact match OR unit-level match (any CHOs in the same CHO unit get notified)
                let isCho = false;
                if (user.role === 'CHO') {
                    if (barangayId === null) {
                        isCho = true; // broadcast — all CHOs see it
                    } else {
                        const exactMatch = Number(user.assigned_barangay_id) === Number(barangayId);
                        const userUnit = getChoUnitForBarangay(user.barangay_name);
                        isCho = exactMatch || (caseBarangayUnit && userUnit && caseBarangayUnit === userUnit);
                    }
                }

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
                    const eventAllowed = !eventType || eventType === 'delete' || prefs[eventType] == true;

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
                        sendBrevoEmail(user.email, title, `
                            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                                <h2 style="color:#1e293b;margin:0 0 8px 0">${title}</h2>
                                <p style="color:#475569;font-size:15px;line-height:1.5">${message}</p>
                                <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                                <p style="color:#94a3b8;font-size:12px">Cabuyao City Disease Monitoring System</p>
                            </div>`
                        ).catch(err => console.error(`Email notification failed for user ${user.user_id}:`, err.message));
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
    };

    // Look up case barangay CHO unit before proceeding
    if (barangayId) {
        db.query('SELECT name FROM barangays WHERE id = ?', [barangayId], (err, rows) => {
            const caseUnit = (!err && rows.length > 0) ? getChoUnitForBarangay(rows[0].name) : null;
            proceed(caseUnit);
        });
    } else {
        proceed(null);
    }
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

// DELETE /api/users/:id/my-data — clear current user's personal data & reset account
app.delete('/api/users/:id/my-data', (req, res) => {
  const { id } = req.params;

  db.query('SELECT user_id, username, full_name, email, role, assigned_barangay_id, password, initial_password FROM users WHERE user_id = ?',
    [id], (err, userResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (userResults.length === 0)
      return res.status(404).json({ error: 'User not found.' });

    const user = userResults[0];
    const resetPassword = user.initial_password || user.password;

    // 1. Final audit log before clearing
    createAuditLog(id, user.full_name || 'User', user.role, null, null, 'Cleared', 'Account Data', 'User cleared all personal account data and was logged out');

    // 2. Delete user-scoped records
    const queries = [
      'DELETE FROM notifications WHERE user_id = ?',
      'DELETE FROM notification_preferences WHERE user_id = ?',
      'DELETE FROM audit_logs WHERE user_id = ?',
      'DELETE FROM generated_reports WHERE created_by = ?',
      'DELETE FROM case_inbox WHERE from_user_id = ?',
    ];

    let completed = 0;
    queries.forEach((sql, index) => {
      db.query(sql, [id], (delErr) => {
        if (delErr) console.error(`Clear data query ${index} error:`, delErr.message);
        completed++;
        if (completed === queries.length) {
          // 3. Reset password to initial_password
          db.query('UPDATE users SET password = ? WHERE user_id = ?', [resetPassword, id], (updateErr) => {
            if (updateErr) {
              console.error('Password reset error:', updateErr.message);
              return res.status(500).json({ error: 'Failed to reset password.' });
            }

            // 4. Send email notification with reset password
            if (user.email) {
              const htmlContent = `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                  <h2 style="color:#1e3a8a;margin:0 0 12px 0">Account Data Cleared</h2>
                  <p style="color:#475569;font-size:15px;line-height:1.5">
                    Your Cabuyao Health System account data has been cleared successfully.
                  </p>
                  <p style="color:#475569;font-size:15px;line-height:1.5">
                    Your account has been reset to its original credentials:
                  </p>
                  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:0 0 8px 0;font-size:14px;color:#334155">
                      <strong>Username:</strong> ${user.username}
                    </p>
                    <p style="margin:0;font-size:14px;color:#334155">
                      <strong>Password:</strong> ${resetPassword}
                    </p>
                  </div>
                  <p style="color:#94a3b8;font-size:12px">
                    You have been logged out. Please sign in again with the credentials above.
                  </p>
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                  <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
                </div>
              `;
              sendBrevoEmail(user.email, 'Account Data Cleared — Cabuyao CDMS', htmlContent)
                .catch(err => console.error('Clear-data email failed:', err.message));
            }

            console.log(`Cleared personal data for user ${id} (${user.username}) — password reset to original`);
            res.status(200).json({
              message: 'Your personal data has been cleared successfully. You have been logged out.',
              logged_out: true,
            });
          });
        }
      });
    });
  });
});

// ==========================================
// RESIDENT PORTAL ROUTES
// ==========================================

// POST /api/contact-messages — Resident contact form submission
app.post('/api/contact-messages', (req, res) => {
  const { name, email, targetCho, disease, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  db.query(
    `INSERT INTO contact_messages (name, email, target_cho_unit, disease_name, message)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, targetCho || null, disease || null, message],
    (err, result) => {
      if (err) {
        console.error('Error saving contact message:', err.message);
        return res.status(500).json({ error: 'Failed to save message.' });
      }

      // Create notification for users in the target CHO unit (only if push_notifications is ON)
      if (targetCho) {
        db.query(
          `SELECT u.user_id FROM users u
           INNER JOIN notification_preferences np ON u.user_id = np.user_id
           WHERE u.role = 'CHO' AND np.push_notifications = 1 AND u.assigned_barangay_id IN (
            SELECT id FROM barangays WHERE name IN (
              SELECT covered FROM (
                SELECT 'Sala' AS covered UNION SELECT 'Bigaa' UNION SELECT 'Butong'
                UNION SELECT 'Marinig' UNION SELECT 'Gulod' UNION SELECT 'Niugan'
                UNION SELECT 'Baclaran' UNION SELECT 'Barangay Uno (Poblacion)'
                UNION SELECT 'Barangay Dos (Poblacion)' UNION SELECT 'Barangay Tres (Poblacion)'
              ) AS t1 WHERE ? = 'CHO Unit I (Sala)'
              UNION ALL
              SELECT 'Pulo' AS covered UNION SELECT 'Banay-Banay' UNION SELECT 'Banlic'
              UNION SELECT 'Mamatid' UNION SELECT 'San Isidro' UNION SELECT 'Diezmo'
              UNION SELECT 'Pittland' UNION SELECT 'Casile'
              FROM (SELECT 1) AS t2 WHERE ? = 'CHO Unit II (Pulo)'
            )
          )`,
          [targetCho, targetCho],
          (err2, users) => {
            if (!err2 && users.length > 0) {
              users.forEach(u => {
                db.query(
                  `INSERT INTO notifications (user_id, title, message, type, link_to)
                   VALUES (?, ?, ?, ?, ?)`,
                  [u.user_id, 'New Contact Message', `A resident sent a message regarding ${disease || 'general health'}.`, 'message', 'Manage Cases']
                );
              });
            }
          }
        );
      }

      console.log(`Contact message from ${name} (${email})`);
      res.status(200).json({ message: 'Message sent successfully!' });
    }
  );
});

// GET /api/contact-messages — Retrieve contact messages (for CHO/BHW inbox)
app.get('/api/contact-messages', (req, res) => {
  const { choUnit, limit } = req.query;
  let sql = 'SELECT * FROM contact_messages';
  const params = [];

  if (choUnit) {
    sql += ' WHERE target_cho_unit = ?';
    params.push(choUnit);
  }

  sql += ' ORDER BY created_at DESC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// PUT /api/contact-messages/:id/read — Mark message as read
app.put('/api/contact-messages/:id/read', (req, res) => {
  db.query('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Message marked as read.' });
  });
});

// GET /api/disease_cases/public-summary — Public case counts per barangay
app.get('/api/disease_cases/public-summary', (req, res) => {
  const sql = `
    SELECT b.name AS barangay_name, COUNT(dc.case_id) AS case_count
    FROM barangays b
    LEFT JOIN disease_cases dc ON dc.barangay_id = b.id
    GROUP BY b.id, b.name
    ORDER BY b.name
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ==========================================
// 7. SCHEDULED JOBS
// ==========================================

// Weekly Summary — every Monday at 8:00 AM (scoped per user / CHO unit / BHW barangay)
cron.schedule('0 8 * * 1', () => {
    console.log('⏰ Running weekly summary cron job...');

    // Helper: run scoped queries for a given set of barangay names, returns [summary, barangays, diseases, severities]
    function runScopedQueries(barangayNames) {
        if (!barangayNames || barangayNames.length === 0) return Promise.resolve(null);
        const ph = barangayNames.map(() => '?').join(',');

        const doQuery = (sql, params) => new Promise((resolve, reject) =>
            db.query(sql, params, (e, r) => e ? reject(e) : resolve(r))
        );

        const summarySQL = `
            SELECT
                COUNT(*) AS total_cases,
                SUM(CASE WHEN dc.date_reported >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS new_this_week,
                SUM(CASE WHEN dc.status IN ('Active','Under Treatment','Pending') THEN 1 ELSE 0 END) AS active_cases,
                SUM(CASE WHEN dc.status = 'Recovered' THEN 1 ELSE 0 END) AS recovered,
                SUM(CASE WHEN dc.status = 'Deceased' THEN 1 ELSE 0 END) AS deceased
            FROM disease_cases dc
            JOIN barangays b ON dc.barangay_id = b.id
            WHERE b.name IN (${ph})`;

        const barangaySQL = `
            SELECT b.name AS barangay_name, COUNT(dc.case_id) AS count
            FROM barangays b
            LEFT JOIN disease_cases dc ON dc.barangay_id = b.id
            WHERE b.name IN (${ph})
            GROUP BY b.id, b.name
            ORDER BY count DESC`;

        const diseaseSQL = `
            SELECT d.name AS disease_name, COUNT(dc.case_id) AS count
            FROM diseases d
            LEFT JOIN disease_cases dc ON dc.disease_id = d.id
            JOIN barangays b ON dc.barangay_id = b.id
            WHERE b.name IN (${ph})
            GROUP BY d.id, d.name
            ORDER BY count DESC`;

        const severitySQL = `
            SELECT dc.severity, COUNT(*) AS count
            FROM disease_cases dc
            JOIN barangays b ON dc.barangay_id = b.id
            WHERE b.name IN (${ph}) AND dc.severity IS NOT NULL
            GROUP BY dc.severity
            ORDER BY FIELD(dc.severity,'Critical','Severe','Moderate','Mild','Asymptomatic')`;

        return Promise.all([
            doQuery(summarySQL, barangayNames).then(r => r[0]),
            doQuery(barangaySQL, barangayNames),
            doQuery(diseaseSQL, barangayNames),
            doQuery(severitySQL, barangayNames),
        ]);
    }

    function buildHtmlAndPlain(summary, barangays, diseases, severities, scopeLabel) {
        const total = summary.total_cases || 0;
        const newWeek = summary.new_this_week || 0;
        const active = summary.active_cases || 0;
        const recovered = summary.recovered || 0;
        const deceased = summary.deceased || 0;

        const topBarangay = barangays.length > 0 ? barangays.slice(0, 5).map(b =>
            `<li>${b.barangay_name}: ${b.count} case${b.count !== 1 ? 's' : ''}</li>`
        ).join('') : '<li>No data</li>';

        const topDisease = diseases.length > 0 ? diseases.slice(0, 5).map(d =>
            `<li>${d.disease_name}: ${d.count} case${d.count !== 1 ? 's' : ''}</li>`
        ).join('') : '<li>No data</li>';

        const sevRows = severities.length > 0 ? severities.map(s =>
            `<tr><td>${s.severity}</td><td style="text-align:right;font-weight:600">${s.count}</td></tr>`
        ).join('') : '<tr><td colspan="2">No data</td></tr>';

        const scopeTitle = scopeLabel ? ` — ${scopeLabel}` : '';

        const html = `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                <h1 style="color:#1e3a8a;font-size:22px;margin:0 0 4px 0">Weekly Summary${scopeTitle}</h1>
                <p style="color:#64748b;font-size:13px;margin:0 0 20px 0">${new Date().toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' })}</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                    <tr>
                        <td style="background:#eff6ff;padding:12px;border-radius:8px 0 0 8px;text-align:center">
                            <div style="font-size:24px;font-weight:700;color:#1e3a8a">${total}</div>
                            <div style="font-size:11px;color:#64748b">Total Cases</div>
                        </td>
                        <td style="background:#fef2f2;padding:12px;text-align:center">
                            <div style="font-size:24px;font-weight:700;color:#dc2626">${newWeek}</div>
                            <div style="font-size:11px;color:#64748b">New This Week</div>
                        </td>
                        <td style="background:#f0fdf4;padding:12px;border-radius:0 8px 8px 0;text-align:center">
                            <div style="font-size:24px;font-weight:700;color:#16a34a">${recovered}</div>
                            <div style="font-size:11px;color:#64748b">Recovered</div>
                        </td>
                    </tr>
                </table>
                <h3 style="color:#1e293b;font-size:15px;margin:0 0 8px 0">Top Barangays</h3>
                <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;color:#334155">${topBarangay}</ul>
                <h3 style="color:#1e293b;font-size:15px;margin:0 0 8px 0">Top Diseases</h3>
                <ul style="margin:0 0 20px 0;padding-left:20px;font-size:14px;color:#334155">${topDisease}</ul>
                <h3 style="color:#1e293b;font-size:15px;margin:0 0 8px 0">By Severity</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                    <tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Severity</th><th style="padding:8px 12px;text-align:right">Count</th></tr>
                    ${sevRows}
                </table>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
                <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
            </div>`;

        const plain = `📊 Weekly Summary${scopeTitle}\n\nTotal: ${total} | New: ${newWeek} | Active: ${active} | Recovered: ${recovered} | Deceased: ${deceased}\n\nTop Barangay: ${barangays[0]?.barangay_name || 'N/A'} (${barangays[0]?.count || 0} cases)`;

        return { html, plain };
    }

    function sendToUsers(users, html, plain) {
        users.forEach(user => {
            db.query(
                'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                [user.user_id, '📊 Weekly Summary', plain, 'weekly_summary', 'Dashboard']
            );
            if (user.email) {
                sendBrevoEmail(user.email, '📊 Weekly Summary — Cabuyao CDMS', html)
                    .catch(err => console.error(`Weekly summary email failed for ${user.user_id}:`, err.message));
            }
        });
    }

    // 1. Fetch all eligible users with scope info
    db.query(
        `SELECT u.user_id, u.role, u.assigned_barangay_id, b.name AS barangay_name, u.email, u.full_name, u.mobile_number
         FROM users u
         LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
         INNER JOIN notification_preferences np ON u.user_id = np.user_id
         WHERE u.is_active = 1 AND np.weekly_summary = 1`,
        (err, users) => {
            if (err) { console.error('Weekly summary: error fetching users:', err.message); return; }
            if (users.length === 0) { console.log('No users subscribed to weekly summary.'); return; }

            // 2. Group users by scope
            const groups = {};
            users.forEach(user => {
                let scopeKey, scopeBarangays;
                if (user.role === 'CHO') {
                    const unit = getChoUnitForBarangay(user.barangay_name);
                    if (!unit) return;
                    scopeKey = unit;
                    scopeBarangays = CHO_UNIT_BARANGAYS[unit];
                } else if (user.role === 'BHW' && user.barangay_name) {
                    scopeKey = `BHW:${user.barangay_name}`;
                    scopeBarangays = [user.barangay_name];
                } else {
                    return;
                }
                if (!groups[scopeKey]) {
                    groups[scopeKey] = { scopeLabel: scopeKey, barangayNames: scopeBarangays, users: [] };
                }
                groups[scopeKey].users.push(user);
            });

            const groupList = Object.values(groups);
            if (groupList.length === 0) return;
            console.log(`📧 Weekly summary: ${groupList.length} scope group(s), ${users.length} total user(s)`);

            // 3. Run queries for each group and send
            groupList.forEach(group => {
                runScopedQueries(group.barangayNames).then(results => {
                    if (!results) return;
                    const { html, plain } = buildHtmlAndPlain(...results, group.scopeLabel);
                    sendToUsers(group.users, html, plain);
                }).catch(err => {
                    console.error(`Weekly summary error for group ${group.scopeLabel}:`, err.message);
                });
            });
        }
    );
});

// ==========================================
// 8. SYSTEM MAINTENANCE ENDPOINT
// ==========================================

// POST /api/notifications/system-maintenance — broadcast to all users with preference
app.post('/api/notifications/system-maintenance', (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required.' });
    }

    db.query(
        `SELECT u.user_id, u.email, u.mobile_number
         FROM users u
         WHERE u.is_active = 1`,
        (err, users) => {
            if (err) return res.status(500).json({ error: err.message });

            let sentCount = 0;
            users.forEach(user => {
                db.query(
                    'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                    [user.user_id, title, message, 'system_maintenance', null]
                );
                if (user.email) {
                    sendBrevoEmail(user.email, title,
                        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                            <h2 style="color:#1e293b;margin:0 0 8px 0">⚠️ ${title}</h2>
                            <p style="color:#475569;font-size:15px;line-height:1.5">${message}</p>
                            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                            <p style="color:#94a3b8;font-size:12px">Cabuyao City Disease Monitoring System</p>
                        </div>`
                    ).catch(() => {});
                }
                sentCount++;
            });

            console.log(`System maintenance sent to ${sentCount} user(s)`);
            res.json({ message: `Maintenance notice sent to ${sentCount} user(s).` });
        }
    );
});

// ==========================================
// 9. RESTORE ENDPOINT
// ==========================================

// POST /api/restore — restore from a backup JSON
app.post('/api/restore', (req, res) => {
    const backup = req.body;

    if (!backup || !backup.system || !backup.backup_date) {
        return res.status(400).json({ error: 'Invalid backup file format. Please upload a valid CDMS backup JSON.' });
    }

    const restoreDiseaseCases = (callback) => {
        if (!backup.disease_cases || backup.disease_cases.length === 0) return callback();
        let done = 0;
        backup.disease_cases.forEach(c => {
            db.query(
                `INSERT IGNORE INTO disease_cases (case_id, patient_name, age, gender, contact, address, symptoms, physician, onset_date, severity, status, date_reported, latitude, longitude, disease_id, barangay_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [c.case_id, c.patient_name, c.age, c.gender, c.contact, c.address, c.symptoms, c.physician, c.onset_date, c.severity, c.status, c.date_reported, c.latitude, c.longitude, c.disease_id, c.barangay_id],
                (err) => { if (err) console.error('Restore case error:', err.message); done++; if (done >= backup.disease_cases.length) callback(); }
            );
        });
    };

    const restoreUsers = (callback) => {
        if (!backup.users || backup.users.length === 0) return callback();
        let done = 0;
        backup.users.forEach(u => {
            db.query(
                `INSERT IGNORE INTO users (user_id, username, full_name, role, assigned_barangay_id, is_active, email, mobile_number, last_login)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [u.user_id, u.username, u.full_name, u.role, u.assigned_barangay_id, u.is_active, u.email, u.mobile_number, u.last_login],
                (err) => { if (err) console.error('Restore user error:', err.message); done++; if (done >= backup.users.length) callback(); }
            );
        });
    };

    const restoreBarangays = (callback) => {
        if (!backup.barangays || backup.barangays.length === 0) return callback();
        let done = 0;
        backup.barangays.forEach(b => {
            db.query(
                `INSERT IGNORE INTO barangays (id, name) VALUES (?, ?)`,
                [b.id, b.name],
                (err) => { if (err) console.error('Restore barangay error:', err.message); done++; if (done >= backup.barangays.length) callback(); }
            );
        });
    };

    const restoreDiseases = (callback) => {
        if (!backup.diseases || backup.diseases.length === 0) return callback();
        let done = 0;
        backup.diseases.forEach(d => {
            db.query(
                `INSERT IGNORE INTO diseases (id, name) VALUES (?, ?)`,
                [d.id, d.name],
                (err) => { if (err) console.error('Restore disease error:', err.message); done++; if (done >= backup.diseases.length) callback(); }
            );
        });
    };

    restoreDiseases(() => {
        restoreBarangays(() => {
            restoreUsers(() => {
                restoreDiseaseCases(() => {
                    console.log('✅ Restore completed from backup dated ' + backup.backup_date);
                    res.json({ message: 'Restore completed successfully.' });
                });
            });
        });
    });
});

// POST /api/restore/confirm — preview what will be restored before committing
app.post('/api/restore/preview', (req, res) => {
    const backup = req.body;
    if (!backup || !backup.system || !backup.backup_date) {
        return res.status(400).json({ error: 'Invalid backup file.' });
    }

    res.json({
        backup_date: backup.backup_date,
        system: backup.system,
        version: backup.version,
        counts: {
            disease_cases: backup.disease_cases?.length || 0,
            users: backup.users?.length || 0,
            barangays: backup.barangays?.length || 0,
            diseases: backup.diseases?.length || 0,
        }
    });
});

// ==========================================
// 10. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});