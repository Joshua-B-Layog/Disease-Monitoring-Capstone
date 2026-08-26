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
const bcrypt = require('bcryptjs');

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
    console.log(`Email sent to: ${to}`);
  } catch (err) {
    console.error('Brevo API error:', err.response?.data || err.message);
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

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

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

// Add updated_at column to disease_cases if missing (required for offline sync conflict detection)
db.query("SHOW COLUMNS FROM disease_cases LIKE 'updated_at'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE disease_cases ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER date_reported", (alterErr) => {
            if (alterErr) console.error('Migration error adding updated_at:', alterErr.message);
            else console.log('Migration: added updated_at column to disease_cases table');
        });
    }
});

// Add icon/color/description columns to diseases if missing (for "Add New Disease" full persistence)
db.query("SHOW COLUMNS FROM diseases LIKE 'icon'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE diseases ADD COLUMN icon VARCHAR(100) DEFAULT NULL, ADD COLUMN color VARCHAR(20) DEFAULT NULL, ADD COLUMN description VARCHAR(255) DEFAULT NULL", (alterErr) => {
            if (alterErr) console.error('Migration error adding disease metadata columns:', alterErr.message);
            else console.log('Migration: added icon/color/description columns to diseases table');
        });
    }
});

// Custom disease categories (persisted user-created categories for the disease carousel)
db.query(`CREATE TABLE IF NOT EXISTS disease_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(100) DEFAULT NULL,
    color VARCHAR(20) DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error('Error creating disease_categories table:', err.message);
    else console.log('disease_categories table created/verified');
});

// Join table linking diseases to custom categories
db.query(`CREATE TABLE IF NOT EXISTS disease_category_items (
    category_id INT NOT NULL,
    disease_id INT NOT NULL,
    PRIMARY KEY (category_id, disease_id),
    FOREIGN KEY (category_id) REFERENCES disease_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (disease_id) REFERENCES diseases(id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('Error creating disease_category_items table:', err.message);
    else console.log('disease_category_items table created/verified');
});

db.query('CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, title VARCHAR(255), message TEXT, type VARCHAR(50), is_read TINYINT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, link_to VARCHAR(100), reference_id INT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id))', (err) => {
    if (err) console.error('Error creating notifications table:', err.message);
    else {
        console.log('Notifications table created/verified');
        // Migration: add reference_id column if missing
        db.query("SHOW COLUMNS FROM notifications LIKE 'reference_id'", (e, r) => {
            if (!e && r && r.length === 0) {
                db.query('ALTER TABLE notifications ADD COLUMN reference_id INT NULL', (ae) => {
                    if (ae) console.error('Error adding reference_id column:', ae.message);
                    else console.log('Added reference_id column to notifications');
                });
            }
        });
    }
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
    updated_case_reported BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)`, (err) => {
    if (err) console.error('Error creating notification_preferences table:', err.message);
    else {
        console.log('Notification preferences table created/verified');
        // Migration: add updated_case_reported column if missing
        db.query("SHOW COLUMNS FROM notification_preferences LIKE 'updated_case_reported'", (e, r) => {
            if (!e && r && r.length === 0) {
                db.query('ALTER TABLE notification_preferences ADD COLUMN updated_case_reported BOOLEAN DEFAULT FALSE', (ae) => {
                    if (ae) console.error('Error adding updated_case_reported column:', ae.message);
                    else console.log('Added updated_case_reported column to notification_preferences');
                });
            }
        });
    }
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
  target_cho_unit VARCHAR(100),
  disease_name VARCHAR(255),
  message TEXT NOT NULL,
  age INT,
  gender VARCHAR(10),
  contact_no VARCHAR(50),
  address TEXT,
  is_read TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Error creating contact_messages table:', err.message);
  else {
    console.log('Contact messages table created/verified');
    // Migration: ensure new columns exist on existing tables
    ['age', 'gender', 'contact_no', 'address'].forEach(col => {
      db.query("SHOW COLUMNS FROM contact_messages LIKE ?", [col], (e, r) => {
        if (!e && r && r.length === 0) {
          const colDef = col === 'age' ? 'INT' : col === 'gender' ? 'VARCHAR(10)' : col === 'contact_no' ? 'VARCHAR(50)' : 'TEXT';
          db.query(`ALTER TABLE contact_messages ADD COLUMN ${col} ${colDef}`, (ae) => {
            if (ae) console.error(`Error adding ${col} column:`, ae.message);
            else console.log(`Added ${col} column to contact_messages`);
          });
        }
      });
    });
    // Migration: drop email column if it exists (resident contact form no longer uses it)
    db.query("SHOW COLUMNS FROM contact_messages LIKE 'email'", (e, r) => {
      if (!e && r && r.length > 0) {
        db.query('ALTER TABLE contact_messages DROP COLUMN email', (de) => {
          if (de) console.error('Error dropping email column:', de.message);
          else console.log('Dropped email column from contact_messages');
        });
      }
    });
    // Migration: add status column to contact_messages
    db.query("SHOW COLUMNS FROM contact_messages LIKE 'status'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE contact_messages ADD COLUMN status VARCHAR(20) DEFAULT 'new'", (ae) => {
          if (ae) console.error('Error adding status column:', ae.message);
          else console.log('Added status column to contact_messages');
        });
      }
    });
    // Migration: add barangay column to contact_messages
    db.query("SHOW COLUMNS FROM contact_messages LIKE 'barangay'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE contact_messages ADD COLUMN barangay VARCHAR(100)", (ae) => {
          if (ae) console.error('Error adding barangay column:', ae.message);
          else console.log('Added barangay column to contact_messages');
        });
      }
    });
  }
});

db.query(`CREATE TABLE IF NOT EXISTS case_edit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  requested_by INT NOT NULL,
  requested_by_name VARCHAR(255),
  from_barangay_name VARCHAR(100),
  target_cho_unit VARCHAR(100),
  note TEXT,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (case_id) REFERENCES disease_cases(case_id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(user_id)
)`, (err) => {
  if (err) console.error('Error creating case_edit_requests table:', err.message);
  else console.log('Case edit requests table created/verified');
  // Migration: add is_read column to case_edit_requests
  db.query("SHOW COLUMNS FROM case_edit_requests LIKE 'is_read'", (e, r) => {
    if (!e && r && r.length === 0) {
      db.query("ALTER TABLE case_edit_requests ADD COLUMN is_read TINYINT(1) DEFAULT 0", (ae) => {
        if (ae) console.error('Error adding is_read column to case_edit_requests:', ae.message);
        else console.log('Added is_read column to case_edit_requests');
      });
    }
  });
});

// Create password_change_requests table for BHW → CHO password change workflow
db.query(`CREATE TABLE IF NOT EXISTS password_change_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255),
  status ENUM('pending','accepted','rejected','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  is_read TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
)`, (err) => {
  if (err) console.error('Error creating password_change_requests table:', err.message);
  else console.log('Password change requests table created/verified');
  // Migration: add user_name column if missing
  db.query("SHOW COLUMNS FROM password_change_requests LIKE 'user_name'", (une, unr) => {
    if (!une && (!unr || unr.length === 0)) {
      db.query("ALTER TABLE password_change_requests ADD COLUMN user_name VARCHAR(255)", (ae) => {
        if (ae) console.error('Error adding user_name to password_change_requests:', ae.message);
        else console.log('Added user_name column to password_change_requests');
      });
    }
  });
  // Migration: add is_read column if missing
  db.query("SHOW COLUMNS FROM password_change_requests LIKE 'is_read'", (ire, irr) => {
    if (!ire && (!irr || irr.length === 0)) {
      db.query("ALTER TABLE password_change_requests ADD COLUMN is_read TINYINT(1) DEFAULT 0", (ae) => {
        if (ae) console.error('Error adding is_read to password_change_requests:', ae.message);
        else console.log('Added is_read column to password_change_requests');
      });
    }
  });
  // Migration: add 'resolved' to status ENUM if missing
  db.query("SHOW COLUMNS FROM password_change_requests LIKE 'status'", (me, mr) => {
    if (!me && mr && mr.length > 0) {
      db.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'password_change_requests' AND COLUMN_NAME = 'status'", [process.env.DB_NAME], (ie, ir) => {
        if (!ie && ir && ir.length > 0 && !ir[0].COLUMN_TYPE.includes('resolved')) {
          db.query("ALTER TABLE password_change_requests MODIFY COLUMN status ENUM('pending','accepted','rejected','resolved') DEFAULT 'pending'", (ae) => {
            if (ae) console.error('Error adding resolved to password_change_requests status:', ae.message);
            else console.log('Added resolved to password_change_requests status ENUM');
          });
        }
      });
    }
  });
});

// Migration: add status column to users table for BHW registration approval
db.query("SHOW COLUMNS FROM users LIKE 'status'", (e, r) => {
  if (!e && r && r.length === 0) {
    db.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT NULL", (ae) => {
      if (ae) console.error('Error adding status column to users:', ae.message);
      else console.log('Added status column to users');
    });
  }
});

// Case status history table
db.query(`CREATE TABLE IF NOT EXISTS case_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by INT,
  changed_by_name VARCHAR(255),
  changed_by_role VARCHAR(20),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (case_id) REFERENCES disease_cases(case_id) ON DELETE CASCADE
)`, (err) => {
  if (err) console.error('Error creating case_status_history table:', err.message);
  else console.log('Case status history table created/verified');
});

function createAuditLog(userId, userName, userRole, choUnit, barangay, action, entity, details) {
  db.query(
    'INSERT INTO audit_logs (user_id, user_name, user_role, cho_unit, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId || null, userName || 'System', userRole || 'System', choUnit || null, barangay || null, action, entity, details],
    (err) => { if (err) console.error('Audit log insert error:', err.message); }
  );
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (!userRole || !roles.includes(userRole)) {
      createAuditLog(
        req.headers['x-user-id'] || null,
        req.headers['x-user-name'] || 'Unknown',
        userRole || 'Unknown',
        null, null,
        'Access Denied',
        req.originalUrl,
        `Attempted to access ${req.method} ${req.originalUrl} with role "${userRole || 'none'}"`
      );
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// ==========================================
// 4. API ROUTES
// ==========================================

// ROUTE: Health check / ping for offline detection
app.get('/api/ping', (req, res) => res.sendStatus(200));

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

// ROUTE: Add a new disease
app.post('/api/diseases', (req, res) => {
    const name = (req.body && req.body.name ? req.body.name : '').trim();
    const icon = (req.body && req.body.icon ? String(req.body.icon).slice(0, 100) : null);
    const color = (req.body && req.body.color ? String(req.body.color).slice(0, 20) : null);
    const description = (req.body && req.body.description ? String(req.body.description).slice(0, 255) : null);
    if (!name) return res.status(400).json({ error: 'Disease name is required.' });
    db.query('INSERT IGNORE INTO diseases (name, icon, color, description) VALUES (?, ?, ?, ?)', [name, icon, color, description], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(409).json({ error: 'Disease already exists.' });
        res.status(201).json({ message: 'Disease added successfully.', id: result.insertId });
    });
});

// ROUTE: Get all custom disease categories (with their linked disease ids)
app.get('/api/disease_categories', (req, res) => {
    db.query('SELECT * FROM disease_categories ORDER BY id', (err, categories) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('SELECT category_id, disease_id FROM disease_category_items', (err2, items) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const byCat = {};
            items.forEach(it => {
                if (!byCat[it.category_id]) byCat[it.category_id] = [];
                byCat[it.category_id].push(it.disease_id);
            });
            res.json(categories.map(c => ({ ...c, diseases: byCat[c.id] || [] })));
        });
    });
});

// ROUTE: Create a custom disease category and link diseases to it
app.post('/api/disease_categories', (req, res) => {
    const name = (req.body && req.body.name ? req.body.name : '').trim();
    const icon = (req.body && req.body.icon ? String(req.body.icon).slice(0, 100) : null);
    const color = (req.body && req.body.color ? String(req.body.color).slice(0, 20) : null);
    const description = (req.body && req.body.description ? String(req.body.description).slice(0, 255) : null);
    const diseaseIds = Array.isArray(req.body && req.body.diseaseIds) ? req.body.diseaseIds.filter(Number.isInteger) : [];
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    db.query('INSERT INTO disease_categories (name, icon, color, description) VALUES (?, ?, ?, ?)', [name, icon, color, description], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists.' });
            return res.status(500).json({ error: err.message });
        }
        const catId = result.insertId;
        if (diseaseIds.length === 0) return res.status(201).json({ message: 'Category added successfully.', id: catId });
        const values = diseaseIds.map(did => [catId, did]);
        db.query('INSERT IGNORE INTO disease_category_items (category_id, disease_id) VALUES ?', [values], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json({ message: 'Category added successfully.', id: catId });
        });
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
        console.log(`Profile updated for user ${id}: ${fullName}`);
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
            const reportTs = (req.body && req.body._offlineTimestamp) ? new Date(req.body._offlineTimestamp) : null;
            const insertQuery = `
                INSERT INTO disease_cases 
                (patient_name, disease_id, age, severity, gender, status, contact, 
                 onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
            `;
            const vals = [
                patient_name, dId, age || 0, severity, gender || 'Male',
                status || 'Active', contact || null, onset_date || null, address || null,
                barangay_id || null, symptoms || null, physician || null,
                latitude || null, longitude || null, reportTs
            ];

            db.query(insertQuery, vals, (insertErr, result) => {
                if (insertErr) {
                    console.error("Insert case error:", insertErr.message);
                    return res.status(500).json({ error: insertErr.message });
                }
                console.log("Case inserted, ID:", result.insertId);

                // Write audit log entry
                const isOfflineCreate = !!(req.body && req.body._offlineTimestamp);
                const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                const auditAction = isOfflineCreate ? 'Synced Case (Offline)' : 'Created';
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                if (auditUserId) {
                  db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                    if (!uErr && uRes.length > 0) {
                      const u = uRes[0];
                      db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                        const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                        const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                        createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record',
                         `Added new ${auditDisease} case for ${auditPatient} (Case ID: ${result.insertId})`);
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
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id, 'new_case_reported', null, result.insertId);
                        
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
                            // Only notify BHWs assigned to this barangay (skip CHOs for BHW-targeted routing)
                            db.query(
                                `SELECT u.user_id FROM users u
                                 INNER JOIN notification_preferences np ON u.user_id = np.user_id
                                 WHERE u.role = 'BHW' AND u.assigned_barangay_id = ? AND np.push_notifications = 1`,
                                [targetBarangayId],
                                (nErr, bhwUsers) => {
                                    if (!nErr && bhwUsers && bhwUsers.length > 0) {
                                        bhwUsers.forEach(u => {
                                            db.query(
                                                'INSERT INTO notifications (user_id, title, message, type, link_to, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
                                                [u.user_id, 'New Case Reported', msg, 'info', 'Inbox', caseId]
                                            );
                                        });
                                    }
                                }
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

// GET unified outbox — merges referrals + resident messages + edit requests
app.get('/api/case-outbox', (req, res) => {
  const { cho_unit, barangay, user_id } = req.query;
  if (!cho_unit) return res.status(400).json({ error: 'cho_unit is required.' });
  const unitBarangays = CHO_UNIT_BARANGAYS[cho_unit] || [];

  const runQuery = (sql, params) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

  (async () => {
    try {
      let referrals, residents, editRequests;

      if (barangay && user_id) {
        // ── BHW scope ──
        referrals = await runQuery(`
          SELECT CONCAT('ref-', ci.id) AS id, 'referral' AS item_type,
            COALESCE(ci.patient_name, dc.patient_name) AS patient_name,
            COALESCE(ci.disease_name, d.name) AS disease_name,
            ci.status, b.name AS barangay_name,
            tb.name AS to_barangay_name, ub.name AS from_barangay_name,
            ci.to_cho_unit, ci.from_cho_unit,
            CASE WHEN ci.from_user_id = ? THEN 'sent' ELSE 'received' END AS direction,
            ci.created_at
          FROM case_inbox ci
          LEFT JOIN disease_cases dc ON ci.case_id = dc.case_id
          LEFT JOIN diseases d ON dc.disease_id = d.id
          LEFT JOIN barangays b ON dc.barangay_id = b.id
          LEFT JOIN barangays tb ON ci.to_barangay_id = tb.id
          LEFT JOIN users u ON ci.from_user_id = u.user_id
          LEFT JOIN barangays ub ON u.assigned_barangay_id = ub.id
          WHERE (ci.from_user_id = ? OR tb.name = ?)
        `, [user_id, user_id, barangay]);

        residents = await runQuery(`
          SELECT CONCAT('res-', cm.id) AS id, 'resident' AS item_type,
            cm.name AS patient_name, cm.disease_name,
            CASE WHEN cm.status = 'accepted' THEN 'accepted' WHEN cm.status = 'rejected' THEN 'rejected' ELSE 'pending' END AS status,
            cm.barangay AS barangay_name,
            NULL AS to_barangay_name, NULL AS from_barangay_name,
            cm.target_cho_unit AS to_cho_unit, NULL AS from_cho_unit,
            'received' AS direction, cm.created_at
          FROM contact_messages cm
          WHERE cm.status IS NOT NULL AND cm.status != 'new' AND cm.barangay = ?
        `, [barangay]);

        editRequests = await runQuery(`
          SELECT CONCAT('er-', cer.id) AS id, 'edit_request' AS item_type,
            dc.patient_name, d.name AS disease_name,
            cer.status, b.name AS barangay_name,
            NULL AS to_barangay_name, cer.from_barangay_name,
            cer.target_cho_unit AS to_cho_unit, NULL AS from_cho_unit,
            'sent' AS direction, cer.created_at
          FROM case_edit_requests cer
          LEFT JOIN disease_cases dc ON cer.case_id = dc.case_id
          LEFT JOIN diseases d ON dc.disease_id = d.id
          LEFT JOIN barangays b ON dc.barangay_id = b.id
          WHERE cer.requested_by = ?
        `, [user_id]);
      } else {
        // ── CHO scope ──
        let referralWhere = '(ci.from_cho_unit = ? OR ci.to_cho_unit = ?)';
        let referralParams = [cho_unit, cho_unit, cho_unit];
        if (unitBarangays.length > 0) {
          const placeholders = unitBarangays.map(() => '?').join(',');
          referralWhere += ` OR tb.name IN (${placeholders})`;
          referralParams.push(...unitBarangays);
        }

        referrals = await runQuery(`
          SELECT CONCAT('ref-', ci.id) AS id, 'referral' AS item_type,
            COALESCE(ci.patient_name, dc.patient_name) AS patient_name,
            COALESCE(ci.disease_name, d.name) AS disease_name,
            ci.status, b.name AS barangay_name,
            tb.name AS to_barangay_name, ub.name AS from_barangay_name,
            ci.to_cho_unit, ci.from_cho_unit,
            CASE WHEN ci.from_cho_unit = ? THEN 'sent' ELSE 'received' END AS direction,
            ci.created_at
          FROM case_inbox ci
          LEFT JOIN disease_cases dc ON ci.case_id = dc.case_id
          LEFT JOIN diseases d ON dc.disease_id = d.id
          LEFT JOIN barangays b ON dc.barangay_id = b.id
          LEFT JOIN barangays tb ON ci.to_barangay_id = tb.id
          LEFT JOIN users u ON ci.from_user_id = u.user_id
          LEFT JOIN barangays ub ON u.assigned_barangay_id = ub.id
          WHERE ${referralWhere}
        `, referralParams);

        residents = await runQuery(`
          SELECT CONCAT('res-', cm.id) AS id, 'resident' AS item_type,
            cm.name AS patient_name, cm.disease_name,
            CASE WHEN cm.status = 'accepted' THEN 'accepted' WHEN cm.status = 'rejected' THEN 'rejected' ELSE 'pending' END AS status,
            cm.barangay AS barangay_name,
            NULL AS to_barangay_name, NULL AS from_barangay_name,
            cm.target_cho_unit AS to_cho_unit, NULL AS from_cho_unit,
            'received' AS direction, cm.created_at
          FROM contact_messages cm
          WHERE cm.status IS NOT NULL AND cm.status != 'new' AND cm.target_cho_unit = ?
        `, [cho_unit]);

        editRequests = await runQuery(`
          SELECT CONCAT('er-', cer.id) AS id, 'edit_request' AS item_type,
            dc.patient_name, d.name AS disease_name,
            cer.status, b.name AS barangay_name,
            NULL AS to_barangay_name, cer.from_barangay_name,
            cer.target_cho_unit AS to_cho_unit, NULL AS from_cho_unit,
            'sent' AS direction, cer.created_at
          FROM case_edit_requests cer
          LEFT JOIN disease_cases dc ON cer.case_id = dc.case_id
          LEFT JOIN diseases d ON dc.disease_id = d.id
          LEFT JOIN barangays b ON dc.barangay_id = b.id
          WHERE cer.target_cho_unit = ?
        `, [cho_unit]);
      }

      // Merge and sort by created_at desc
      const all = [...referrals, ...residents, ...editRequests];
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json(all);
    } catch (err) {
      console.error('Unified outbox error:', err.message);
      res.status(500).json({ error: err.message });
    }
  })();
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

// ── CASE EDIT REQUESTS (BHW → CHO) ──

// POST /api/cases/:id/request-edit — BHW requests CHO to edit a case
app.post('/api/cases/:id/request-edit', (req, res) => {
  const caseId = req.params.id;
  const { requested_by, requested_by_name, from_barangay_name, target_cho_unit, note } = req.body;
  if (!requested_by || !note) {
    return res.status(400).json({ error: 'requested_by and note are required.' });
  }
  db.query(
    'INSERT INTO case_edit_requests (case_id, requested_by, requested_by_name, from_barangay_name, target_cho_unit, note) VALUES (?, ?, ?, ?, ?, ?)',
    [caseId, requested_by, requested_by_name || 'Unknown', from_barangay_name || null, target_cho_unit || null, note],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      // Audit log: BHW submitted an edit request
      db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [requested_by], (aErr, aRes) => {
        if (!aErr && aRes.length > 0) {
          const actor = aRes[0];
          createAuditLog(requested_by, actor.full_name, actor.role, null, from_barangay_name || null,
            'Requested Edit', 'Case Record',
            `Submitted edit request for Case ID ${caseId} — Note: "${note.length > 60 ? note.slice(0, 57) + '...' : note}"`);
        }
      });

      // Notify CHOs in the target unit (direct BHW→CHO request, bypasses user preferences)
      if (target_cho_unit) {
        const unitBarangays = CHO_UNIT_BARANGAYS[target_cho_unit] || [];
        if (unitBarangays.length > 0) {
          db.query(
            `SELECT u.user_id FROM users u
             LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
             WHERE u.role = 'CHO' AND u.is_active = 1
               AND (LOWER(b.name) IN (?) OR u.assigned_barangay_id IS NULL)`,
            [unitBarangays.map(b => b.toLowerCase())],
            (nErr, users) => {
              if (!nErr && users && users.length > 0) {
                const msg = `${requested_by_name || 'A BHW'} from ${from_barangay_name || 'your area'} requested an update for this case. Note: "${note}"`;
                users.forEach(u => {
                  db.query(
                    'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                    [u.user_id, 'A BHW needs your help', msg, 'info', 'Inbox']
                  );
                });
              }
            }
          );
        }
      }
      res.json({ message: 'Edit request sent to your CHO.', request_id: result.insertId });
    }
  );
});

// GET /api/case-edit-requests — Fetch edit requests (CHO: pending by unit, BHW: all by user)
app.get('/api/case-edit-requests', (req, res) => {
  const { cho_unit, requested_by, unread_only } = req.query;
  let sql = `SELECT cer.*, dc.patient_name, d.name AS disease_name, d.name AS disease_name_full
    FROM case_edit_requests cer
    LEFT JOIN disease_cases dc ON cer.case_id = dc.case_id
    LEFT JOIN diseases d ON dc.disease_id = d.id
    WHERE 1=1`;
  const params = [];
  if (cho_unit) {
    sql += ' AND cer.target_cho_unit = ? AND cer.status = ?';
    params.push(cho_unit, 'pending');
  }
  if (requested_by) {
    sql += ' AND cer.requested_by = ?';
    params.push(requested_by);
  }
  if (unread_only === 'true') {
    sql += ' AND cer.is_read = 0';
  }
  sql += ' ORDER BY cer.created_at DESC';
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('case-edit-requests query error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// PUT /api/case-edit-requests/:id/accept — CHO accepts edit request
app.put('/api/case-edit-requests/:id/accept', (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE case_edit_requests SET status = 'accepted', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found or already resolved.' });
      // Return case_id so frontend can open edit mode
      db.query('SELECT case_id FROM case_edit_requests WHERE id = ?', [id], (sErr, rows) => {
        if (sErr || rows.length === 0) return res.json({ message: 'Request accepted.' });
        res.json({ message: 'Edit request accepted.', case_id: rows[0].case_id });
      });
    }
  );
});

// PUT /api/case-edit-requests/:id/reject — CHO rejects edit request
app.put('/api/case-edit-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE case_edit_requests SET status = 'rejected', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found or already resolved.' });
      res.json({ message: 'Edit request rejected.' });
    }
  );
});

// PUT /api/case-edit-requests/:id/read — BHW marks edit request as read
app.put('/api/case-edit-requests/:id/read', (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE case_edit_requests SET is_read = 1 WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found.' });
      res.json({ message: 'Marked as read.' });
    }
  );
});

// ══════════════════════════════════════════════════════════════
// PASSWORD CHANGE REQUESTS (BHW → CHO)
// ══════════════════════════════════════════════════════════════

// POST /api/password-change-request — BHW requests password change
app.post('/api/password-change-request', (req, res) => {
  const { user_id, user_name } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required.' });

  // Check for existing pending request
  db.query(
    "SELECT id FROM password_change_requests WHERE user_id = ? AND status = 'pending'",
    [user_id],
    (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ error: checkErr.message });
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'You already have a pending password change request.' });
      }

      db.query(
        'INSERT INTO password_change_requests (user_id, user_name) VALUES (?, ?)',
        [user_id, user_name || 'Unknown'],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });

          // Notify all active CHO users (bypass preferences — same as case edit requests)
          db.query(
            `SELECT user_id FROM users WHERE role = 'CHO' AND is_active = 1`,
            [],
            (nErr, users) => {
              if (!nErr && users && users.length > 0) {
                const msg = `${user_name || 'A BHW'} is requesting a password change. Please review and approve or reject this request.`;
                users.forEach(u => {
                  db.query(
                    'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                    [u.user_id, 'Password Change Request', msg, 'info', 'Inbox']
                  );
                });
              }
            }
          );

          res.json({ message: 'Password change request sent.', request_id: result.insertId });
        }
      );
    }
  );
});

// GET /api/password-change-requests — Fetch password change requests
app.get('/api/password-change-requests', (req, res) => {
  const { user_id, pending_only } = req.query;
  let sql = 'SELECT * FROM password_change_requests WHERE 1=1';
  const params = [];
  if (user_id) {
    sql += ' AND user_id = ?';
    params.push(user_id);
  }
  if (pending_only === 'true') {
    sql += " AND status = 'pending'";
  }
  sql += ' ORDER BY created_at DESC';
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// PUT /api/password-change-requests/:id/accept — CHO accepts
app.put('/api/password-change-requests/:id/accept', (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE password_change_requests SET status = 'accepted', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Request not found or already resolved.' });

      // Notify the BHW
      db.query('SELECT user_id, user_name FROM password_change_requests WHERE id = ?', [id], (sErr, rows) => {
        if (!sErr && rows && rows.length > 0) {
          const r = rows[0];
          db.query(
            'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
            [r.user_id, 'Password Change Approved', 'Your password change request has been approved. Go to Settings → Account Security to set your new password.', 'info', 'Settings']
          );
        }
      });

      res.json({ message: 'Request accepted.' });
    }
  );
});

// PUT /api/password-change-requests/:id/reject — CHO rejects
app.put('/api/password-change-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE password_change_requests SET status = 'rejected', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Request not found or already resolved.' });

      // Notify the BHW
      db.query('SELECT user_id FROM password_change_requests WHERE id = ?', [id], (sErr, rows) => {
        if (!sErr && rows && rows.length > 0) {
          db.query(
            'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
            [rows[0].user_id, 'Password Change Rejected', 'Your password change request has been rejected by the CHO.', 'info', 'Settings']
          );
        }
      });

      res.json({ message: 'Request rejected.' });
    }
  );
});

// PUT /api/password-change-requests/:id/read — BHW marks as read
app.put('/api/password-change-requests/:id/read', (req, res) => {
  const { id } = req.params;
  db.query('UPDATE password_change_requests SET is_read = 1 WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Request not found.' });
    res.json({ message: 'Marked as read.' });
  });
});

// PUT /api/users/:id/set-password — BHW sets new password after approval (no current password check)
app.put('/api/users/:id/set-password', (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  // Gate: verify an accepted request exists before allowing password change
  db.query('SELECT id FROM password_change_requests WHERE user_id = ? AND status = \'accepted\' LIMIT 1', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) {
      return res.status(403).json({ error: 'No approved password change request found. Please wait for CHO approval.' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, id], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });

      // Mark the accepted request as fully resolved
      db.query("UPDATE password_change_requests SET status = 'resolved', resolved_at = NOW() WHERE user_id = ? AND status = 'accepted'", [id]);

      res.json({ message: 'Password updated successfully.' });
    });
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
            const offlineTs = (req.body && req.body._offlineTimestamp) ? new Date(req.body._offlineTimestamp).getTime() : 0;

            // Fetch full existing record before updating (for status transition + field-level audit logging)
            db.query('SELECT dc.*, d.name AS _oldDiseaseName FROM disease_cases dc LEFT JOIN diseases d ON dc.disease_id = d.id WHERE dc.case_id = ?', [id], (oldErr, oldRows) => {
              const oldRow = (!oldErr && oldRows && oldRows.length > 0) ? oldRows[0] : null;
              const oldStatus = oldRow ? oldRow.status : null;

              // ── Field-level change tracking: build "field: old → new" diff list ──
              const FIELD_LABELS = {
                patient_name: 'Patient Name', age: 'Age', severity: 'Severity', gender: 'Gender',
                status: 'Status', contact: 'Contact', onset_date: 'Date of Onset', address: 'Address',
                symptoms: 'Symptoms', physician: 'Physician', latitude: 'Latitude', longitude: 'Longitude',
              };
              const normalize = (v) => (v === null || v === undefined || v === '') ? '' : String(v);
              const buildChangeSummary = () => {
                if (!oldRow) return '';
                const FIELD_MAP = { patient_name: 'patient_name', age: 'age', severity: 'severity', gender: 'gender', status: 'status', contact: 'contact', onset_date: 'onset_date', address: 'address', symptoms: 'symptoms', physician: 'physician', latitude: 'latitude', longitude: 'longitude' };
                const changes = [];
                for (const [payloadKey, label] of Object.entries(FIELD_LABELS)) {
                  let newVal;
                  if (payloadKey === 'age') newVal = age || 0;
                  else if (payloadKey === 'gender') newVal = gender || 'Male';
                  else if (payloadKey === 'contact') newVal = contact || null;
                  else if (payloadKey === 'onset_date') newVal = onset_date || null;
                  else if (payloadKey === 'address') newVal = address || null;
                  else if (payloadKey === 'symptoms') newVal = symptoms || null;
                  else if (payloadKey === 'physician') newVal = physician || null;
                  else if (payloadKey === 'latitude') newVal = latitude || null;
                  else if (payloadKey === 'longitude') newVal = longitude || null;
                  else newVal = req.body[payloadKey];
                  const oldVal = oldRow[payloadKey];
                  // Compare normalized values; skip empty→empty
                  if (normalize(oldVal) !== normalize(newVal)) {
                    const ov = normalize(oldVal) || '(empty)';
                    const nv = normalize(newVal) || '(empty)';
                    // Truncate long values (symptoms/address)
                    const fmtOv = ov.length > 40 ? ov.slice(0, 37) + '...' : ov;
                    const fmtNv = nv.length > 40 ? nv.slice(0, 37) + '...' : nv;
                    changes.push(`${label}: ${fmtOv} → ${fmtNv}`);
                  }
                }
                // Disease name change (disease_id compared via dId)
                if (oldRow.disease_id !== undefined && Number(oldRow.disease_id) !== Number(dId)) {
                  const oldDiseaseName = req.body._oldDiseaseName || 'Previous Disease';
                  changes.push(`Disease Type: ${oldDiseaseName} → ${disease_name || '(empty)'}`);
                }
                return changes.join(', ');
              };

            const applyUpdate = () => {
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
                console.log("Case updated:", id);

                // Write audit log entry (with field-level change tracking)
                const isOfflineEdit = !!(req.body && req.body._offlineTimestamp);
                const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                const auditAction = isOfflineEdit ? 'Synced Edit (Offline)' : 'Updated';
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                const changeSummary = buildChangeSummary();
                const auditDetails = `Updated ${auditDisease} case for ${auditPatient}${changeSummary ? ` [Changed: ${changeSummary}]` : ' (no field changes)'} (Case ID: ${id})`;
                if (auditUserId) {
                  db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                    if (!uErr && uRes.length > 0) {
                      const u = uRes[0];
                      db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                        const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                        const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                        createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record', auditDetails);
                      });
                    }
                  });
                }

                // Record status transition if status changed
                if (oldStatus && oldStatus !== status) {
                  const historyUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                  const historyUserName = (req.body && (req.body.user_name || req.body._offlineUserName)) || null;
                  db.query(
                    'INSERT INTO case_status_history (case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, oldStatus, status, historyUserId, historyUserName, req.body?.user_role || null],
                    (hErr) => { if (hErr) console.error('Status history error:', hErr.message); }
                  );
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
                        createNotificationForUsers(title, message, 'info', 'ManageCases', caseInfo.barangay_id, 'case_status_updated', null, id);
                        
                        // Check for high risk
                        checkAndAlertHighRisk(caseInfo.barangay_id, caseInfo.barangay_name);

                        // Notify BHW if this edit was from an accepted edit request
                        db.query(
                          `SELECT cer.requested_by, cer.requested_by_name, cer.from_barangay_name
                           FROM case_edit_requests cer
                           WHERE cer.case_id = ? AND cer.status = 'accepted'
                           ORDER BY cer.resolved_at DESC LIMIT 1`,
                          [id],
                          (erErr, erRows) => {
                            if (!erErr && erRows && erRows.length > 0) {
                              const er = erRows[0];
                              const erTitle = 'Updated Case Reported';
                              const erMsg = `A CHO has updated the case of ${caseInfo.patient_name} (${caseInfo.disease_name}).`;
                              db.query(
                                `SELECT np.push_notifications, np.updated_case_reported
                                 FROM notification_preferences np WHERE np.user_id = ?`,
                                [er.requested_by],
                                (pErr, pRows) => {
                                  const prefs = (!pErr && pRows.length > 0) ? pRows[0] : {};
                                  if (prefs.push_notifications && prefs.updated_case_reported) {
                                    db.query(
                                      'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                                      [er.requested_by, erTitle, erMsg, 'info', 'ManageCases']
                                    );
                                  }
                                }
                              );
                            }
                          }
                        );
                    }
                });

                return res.status(200).json({ message: 'Case updated successfully' });
            });
            };
            if (offlineTs) {
                db.query('SELECT updated_at FROM disease_cases WHERE case_id = ?', [id], (cErr, cRows) => {
                    if (cErr) return res.status(500).json({ error: cErr.message });
                    const serverTs = cRows[0] && cRows[0].updated_at ? new Date(cRows[0].updated_at).getTime() : 0;
                    if (serverTs > offlineTs && serverTs > 0) {
                        return res.status(409).json({ error: 'Conflict detected: this case was updated by someone else while you were offline.', _conflict: { caseId: id, serverUpdated: new Date(serverTs).toISOString(), offlineTimestamp: new Date(offlineTs).toISOString() } });
                    }
                    applyUpdate();
                });
            } else {
                applyUpdate();
            }
            }); // end fetch old status
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

// ROUTE: Get status history for a case
app.get('/api/cases/:id/status-history', (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT id, case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role, changed_at, notes
     FROM case_status_history WHERE case_id = ? ORDER BY changed_at ASC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ROUTE: Admin-edit a user account
app.put('/api/users/:id', requireRole('CHO'), async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, email, mobile, barangayId, isActive, role, loggedUserId, newPassword } = req.body;
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
        console.log("User updated:", id);
        // If newPassword provided, update it, email the user, and send in-app notification
        const afterUpdate = () => {
          if (newPassword && newPassword.trim()) {
            const hashedPw = bcrypt.hashSync(newPassword.trim(), 10);
            db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPw, id], (pwErr) => {
              if (pwErr) {
                console.error('Error updating password:', pwErr.message);
                return res.status(500).json({ error: 'User updated but password change failed.' });
              }
              // Send email notification
              db.query('SELECT email, full_name FROM users WHERE user_id = ?', [id], (eErr, eRows) => {
                if (!eErr && eRows && eRows.length > 0 && eRows[0].email) {
                  const userEmail = eRows[0].email;
                  const userName = eRows[0].full_name;
                  sendBrevoEmail(userEmail, 'Your Password Has Been Updated - Cabuyao CDMS',
                    `<div style="font-family:Segoe UI,sans-serif;padding:24px;">
                      <h2 style="color:#121358;">Your Password Has Been Updated</h2>
                      <p>Hello ${userName},</p>
                      <p>Your password has been updated by the City Health Office.</p>
                      <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                        <p style="margin:0;color:#64748b;font-size:13px;">Your new password:</p>
                        <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#121358;letter-spacing:1px;">${newPassword.trim()}</p>
                      </div>
                      <p style="color:#64748b;font-size:13px;">Please log in and change your password for security.</p>
                      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
                      <p style="color:#94a3b8;font-size:11px;">Cabuyao Disease Monitoring System</p>
                    </div>`
                  ).catch(e => console.error('Email notification failed:', e.message));
                }
              });
              // Send in-app notification to the target user
              const pwNotifMsg = 'Your password has been updated by the City Health Office. Please log in with your new password.';
              db.query(
                'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                [id, 'Password Updated', pwNotifMsg, 'info', 'Settings']
              );
              res.status(200).json({ message: 'User updated and password changed. User has been notified via email.' });
            });
          } else {
            res.status(200).json({ message: 'User updated successfully.' });
          }
        };

        if (loggedUserId) {
          db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [loggedUserId], (aErr, aRes) => {
            if (!aErr && aRes.length > 0) {
              const admin = aRes[0];
              const adminName = admin.full_name;
              const adminRole = admin.role;
              const choUnit = (adminRole === 'CHO') ? 'CHO Unit I' : null;
              db.query('SELECT name FROM barangays WHERE id = ?', [admin.assigned_barangay_id], (bErr, bRes) => {
                const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                createAuditLog(loggedUserId, adminName, adminRole, choUnit, brgy, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})${newPassword ? ' + password changed' : ''}`);
                afterUpdate();
              });
            } else {
              createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})`);
              afterUpdate();
            }
          });
        } else {
          createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Updated', 'User Account', `Updated account details for ${fullName} (User ID: ${id})`);
          afterUpdate();
        }
    });
});


// ROUTE: Change password (verified against current password)
app.put('/api/users/:id/change-password', (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    db.query('SELECT password FROM users WHERE user_id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'User not found.' });

        const pwValid = bcrypt.compareSync(currentPassword, results[0].password) || results[0].password === currentPassword;
        if (!pwValid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const hashedNew = bcrypt.hashSync(newPassword, 10);
        db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedNew, id], (updateErr) => {
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
            const isOfflineDelete = !!(req.body && req.body._offlineTimestamp);
            const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
            const auditAction = isOfflineDelete ? 'Synced Delete (Offline)' : 'Deleted';
            const auditDisease = disease_name || 'Unknown Disease';
            const auditPatient = patient_name || 'Unknown Patient';
            if (auditUserId) {
              db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                if (!uErr && uRes.length > 0) {
                  const u = uRes[0];
                  db.query('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                    const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                    const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                    createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record',
                     `Deleted case for ${auditPatient} (${auditDisease}) in Barangay ${barangay_name || 'N/A'} (Case ID: ${id})`);
                  });
                }
              });
            }

            const title = 'Case Deleted';
            const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been deleted.`;
            createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id, 'delete');

            console.log(`Case ${id} deleted from database.`);
            return res.status(200).json({ message: 'Case deleted successfully.' });
        });
    });
});

// ROUTE: Delete a user account
app.delete('/api/users/:id', requireRole('CHO'), (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE user_id = ?', [id], (err, result) => {
        if (err) {
            console.error("Delete user error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log(`User ${id} deleted.`);
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

    const query = `
        SELECT u.*, b.name AS assigned_barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        WHERE (u.username = ? OR u.email = ?)
        AND u.role = ?
        AND u.is_active = 1
    `;

    db.query(query, [email, email, role], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials or account not found.' });
        }

        const user = results[0];

        // Verify password: try bcrypt first, fallback to plaintext for legacy accounts
        const passwordMatch = bcrypt.compareSync(password, user.password);
        const plaintextMatch = !passwordMatch && user.password === password;

        if (!passwordMatch && !plaintextMatch) {
            return res.status(401).json({ error: 'Invalid credentials or account not found.' });
        }

        // Auto-upgrade plaintext password to bcrypt on first login after hashing was added
        if (plaintextMatch) {
            const hashed = bcrypt.hashSync(password, 10);
            db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, user.user_id]);
        }

        // Block login for pending or rejected registrations
        if (user.status === 'pending') {
            return res.status(403).json({ error: 'Your registration is pending approval. Please wait for a CHO administrator to review your account.' });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ error: 'Your registration was not approved. Please contact your local CHO office for assistance.' });
        }

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

// ROUTE: Log out (audit trail)
app.post('/api/logout', (req, res) => {
    const { userId, userName, userRole, barangay } = req.body;
    createAuditLog(userId || null, userName || 'Unknown', userRole || 'System', null, barangay || null, 'Logged Out', 'System', `Logout at ${new Date().toISOString()}`);
    res.json({ ok: true });
});

// ROUTE: Register new user
app.post('/api/register', (req, res) => {
    const { name, username: bodyUsername, email, mobile, password, role, context } = req.body;
    const enforcedRole = 'BHW'; // Public self-registration is BHW-only. CHO accounts must be created via User Management by an existing CHO admin.

    console.log("--- Registration Request ---", { name, email, role: enforcedRole, context });

    const username = bodyUsername || email.split('@')[0];

    let assignedBarangayId = null;
    let assignedBarangayName = null;

    if (context) {
        const parsed = parseInt(context);
        if (!isNaN(parsed)) assignedBarangayId = parsed;
    }

    // Look up barangay name for notifications
    const lookupBarangay = assignedBarangayId
        ? new Promise((resolve) => {
            db.query('SELECT name FROM barangays WHERE id = ?', [assignedBarangayId], (e, rows) => {
                assignedBarangayName = (rows && rows.length > 0) ? rows[0].name : null;
                resolve();
            });
        })
        : Promise.resolve();

    lookupBarangay.then(() => {
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

    // is_active = 0, status = 'pending' until CHO approves
    const insertQuery = `
        INSERT INTO users (username, full_name, email, mobile_number, password, initial_password, role, assigned_barangay_id, is_active, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')
    `;

    const hashedPw = bcrypt.hashSync(password, 10);
    db.query(insertQuery, [username, name, email, mobile || null, hashedPw, hashedPw, enforcedRole, assignedBarangayId], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }
            return res.status(500).json({ message: 'Registration failed: ' + err.message });
        }

        const newUserId = result.insertId;
        const barangayLabel = assignedBarangayName || 'Unknown Barangay';

        // Notify all active CHO users about the new registration
        db.query(
            `SELECT user_id FROM users WHERE role = 'CHO' AND is_active = 1`,
            (notifErr, choUsers) => {
                if (!notifErr && choUsers.length > 0) {
                    const notifMsg = `${name} has requested a BHW account for ${barangayLabel}.`;
                    choUsers.forEach(cho => {
                        db.query(
                            'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                            [cho.user_id, 'New BHW Registration Request', notifMsg, 'info', 'Registrations']
                        );
                    });
                }
            }
        );

        console.log("Registered (pending approval):", { username, role: enforcedRole, assignedBarangayId });
        res.status(200).json({ message: 'Account registered successfully! Your registration is pending CHO approval. You will receive an email once reviewed.' });
    });
});
    }); // end lookupBarangay
});

// ==========================================
// OFFLINE SYNC ENDPOINT
// ==========================================
app.post('/api/sync', (req, res) => {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ error: 'No operations provided.' });
    }
    if (operations.length > 50) {
        return res.status(400).json({ error: 'Too many operations. Max 50 per sync batch.' });
    }

    const results = [];
    const conflicts = [];
    let processed = 0;

    const processNext = (index) => {
        if (index >= operations.length) {
            return res.json({ synced: processed, failed: operations.length - processed, conflicts, results });
        }

        const op = operations[index];
        const { type, endpoint, method, payload } = op;

        if (type === 'create' && endpoint === '/api/cases') {
            const p = payload || {};
            const doInsert = (dId) => {
                const insertQuery = `
                    INSERT INTO disease_cases
                        (patient_name, disease_id, age, severity, gender, status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const ts = p._offlineTimestamp ? new Date(p._offlineTimestamp) : new Date();
                db.query(insertQuery, [
                    p.patient_name, dId, p.age, p.severity || 'Moderate',
                    p.gender || 'Other', p.status || 'Active', p.contact,
                    p.onset_date, p.address, p.barangay_id, p.symptoms,
                    p.physician, p.latitude, p.longitude, ts
                ], (err, result) => {
                    if (err) {
                        console.error('[Sync] Create failed:', err.message);
                        results.push({ type, error: err.message });
                    } else {
                        processed++;
                        results.push({ type, newCaseId: result.insertId });
                        if (p._offlineUserId) {
                            createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', null, null, null, 'Synced Case (Offline)', 'Disease Case', `Offline case synced: ${p.patient_name} — ${p.disease_name}`);
                        }
                    }
                    processNext(index + 1);
                });
            };
            const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
            db.query(findDiseaseQuery, [p.disease_name], (dErr, diseaseResults) => {
                let diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;
                if (!diseaseId && p.disease_name) {
                    db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [p.disease_name], (iErr, iResult) => {
                        const newId = iResult && iResult.insertId ? iResult.insertId : null;
                        doInsert(newId);
                    });
                } else {
                    doInsert(diseaseId);
                }
            });
        } else if (type === 'edit' && endpoint && endpoint.startsWith('/api/cases/')) {
            const caseId = endpoint.split('/').pop();
            const p = payload || {};
            const doEdit = (dId) => {
                const updateQuery = `
                    UPDATE disease_cases SET
                        patient_name=?, disease_id=?, age=?, severity=?, gender=?, status=?,
                        contact=?, onset_date=?, address=?, barangay_id=?, symptoms=?,
                        physician=?, latitude=?, longitude=?, updated_at=NOW()
                    WHERE case_id=?
                `;
                db.query(updateQuery, [
                    p.patient_name, dId, p.age, p.severity,
                    p.gender, p.status, p.contact, p.onset_date, p.address,
                    p.barangay_id, p.symptoms, p.physician, p.latitude, p.longitude, caseId
                ], (err) => {
                    if (err) {
                        results.push({ type, error: err.message });
                    } else {
                        processed++;
                        results.push({ type, caseId });
                        if (p._offlineUserId) {
                            createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', null, null, null, 'Synced Edit (Offline)', 'Disease Case', `Offline edit synced for case #${caseId}`);
                        }
                    }
                    processNext(index + 1);
                });
            };
            db.query(
                `SELECT updated_at FROM disease_cases WHERE case_id = ?`, [caseId],
                (selErr, rows) => {
                    if (selErr || rows.length === 0) {
                        results.push({ type, error: 'Case not found' });
                        return processNext(index + 1);
                    }
                    const serverUpdated = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;
                    const offlineTimestamp = p._offlineTimestamp || 0;
                    if (serverUpdated > offlineTimestamp && serverUpdated > 0) {
                        conflicts.push({ caseId, serverUpdated: new Date(serverUpdated).toISOString(), offlineTimestamp: new Date(offlineTimestamp).toISOString() });
                        results.push({ type, conflict: true, caseId });
                        return processNext(index + 1);
                    }
                    const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
                    db.query(findDiseaseQuery, [p.disease_name], (dErr, dRows) => {
                        const dId = dRows && dRows.length > 0 ? dRows[0].id : null;
                        if (!dId && p.disease_name) {
                            db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [p.disease_name], (iErr, iResult) => {
                                const newId = iResult && iResult.insertId ? iResult.insertId : null;
                                doEdit(newId);
                            });
                        } else {
                            doEdit(dId);
                        }
                    });
                }
            );
        } else if (type === 'delete' && endpoint && endpoint.startsWith('/api/cases/')) {
            const caseId = endpoint.split('/').pop();
            db.query('DELETE FROM disease_cases WHERE case_id = ?', [caseId], (err) => {
                if (err) {
                    results.push({ type, error: err.message });
                } else {
                    processed++;
                    results.push({ type, caseId });
                    if (payload && payload._offlineUserId) {
                        createAuditLog(payload._offlineUserId, payload._offlineUserName || 'Offline User', null, null, null, 'Synced Delete (Offline)', 'Disease Case', `Offline delete synced for case #${caseId}`);
                    }
                }
                processNext(index + 1);
            });
        } else if (type === 'message' && endpoint === '/api/contact-messages') {
            const p = payload || {};
            const detectedBarangay = detectBarangayFromAddress(p.address);
            db.query(
                `INSERT INTO contact_messages (name, target_cho_unit, disease_name, message, age, gender, contact_no, address, barangay, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.name, p.targetCho || null, p.disease || p.disease_name || null, p.message, p.age || null, p.gender || null, p.contact || p.mobile || null, p.address || null, detectedBarangay || p.barangay || null, new Date(p._offlineTimestamp || Date.now())],
                (err) => {
                    if (err) {
                        results.push({ type, error: err.message });
                    } else {
                        processed++;
                        results.push({ type, success: true });
                    }
                    processNext(index + 1);
                }
            );
        } else {
            results.push({ type, error: `Unsupported sync operation: ${type} ${endpoint}` });
            processNext(index + 1);
        }
    };

    processNext(0);
});

// ==========================================
// BHW REGISTRATION APPROVAL ROUTES
// ==========================================

// GET /api/pending-registrations?cho_unit=...
app.get('/api/pending-registrations', (req, res) => {
    const { cho_unit } = req.query;
    let sql = `SELECT u.user_id, u.username, u.full_name, u.email, u.mobile_number, u.status,
                      u.assigned_barangay_id, b.name AS barangay_name, u.created_at
               FROM users u
               LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
               WHERE u.status = 'pending' AND u.role = 'BHW'`;
    const params = [];
    if (cho_unit) {
        const unitBarangays = CHO_UNIT_BARANGAYS[cho_unit] || [];
        if (unitBarangays.length > 0) {
            const ph = unitBarangays.map(() => '?').join(',');
            sql += ` AND b.name IN (${ph})`;
            params.push(...unitBarangays);
        }
    }
    sql += ' ORDER BY u.user_id DESC';
    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// PUT /api/pending-registrations/:id/approve
app.put('/api/pending-registrations/:id/approve', (req, res) => {
    const { id } = req.params;
    db.query(
        `SELECT user_id, full_name, email, assigned_barangay_id FROM users WHERE user_id = ? AND status = 'pending'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows.length === 0) return res.status(404).json({ error: 'Registration not found or already processed.' });
            const user = rows[0];

            db.query(
                `UPDATE users SET is_active = 1, status = 'approved' WHERE user_id = ?`,
                [id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    // Send approval email
                    if (user.email) {
                        const html = `
                            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f0fdf4;border-radius:12px">
                                <h2 style="color:#16a34a;margin:0 0 8px 0">Registration Approved</h2>
                                <p style="color:#334155;font-size:14px">Hello ${user.full_name},</p>
                                <p style="color:#334155;font-size:14px">Your BHW account has been approved. You can now log in to the Cabuyao Disease Monitoring System.</p>
                                <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                                <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
                            </div>`;
                        sendBrevoEmail(user.email, 'BHW Registration Approved - Cabuyao CDMS', html)
                            .catch(err => console.error(`Approval email failed for user ${id}:`, err.message));
                    }

                    // Audit log: registration approved
                    const actorId = (req.body && req.body.actor_id) || null;
                    if (actorId) {
                      db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [actorId], (aErr, aRes) => {
                        if (!aErr && aRes.length > 0) {
                          const actor = aRes[0];
                          db.query('SELECT name FROM barangays WHERE id = ?', [actor.assigned_barangay_id], (bErr2, bRes2) => {
                            const actorBrgy = (!bErr2 && bRes2.length > 0) ? bRes2[0].name : null;
                            createAuditLog(actorId, actor.full_name, actor.role, getChoUnitForBarangay(actorBrgy), actorBrgy,
                              'Approved', 'User Registration',
                              `Approved BHW registration for ${user.full_name} (User ID: ${user.user_id})`);
                          });
                        }
                      });
                    }

                    res.json({ message: `Registration for ${user.full_name} approved.` });
                }
            );
        }
    );
});

// PUT /api/pending-registrations/:id/reject
app.put('/api/pending-registrations/:id/reject', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    db.query(
        `SELECT user_id, full_name, email FROM users WHERE user_id = ? AND status = 'pending'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows.length === 0) return res.status(404).json({ error: 'Registration not found or already processed.' });
            const user = rows[0];

            db.query(
                `UPDATE users SET is_active = 0, status = 'rejected' WHERE user_id = ?`,
                [id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    // Send rejection email
                    if (user.email) {
                        const reasonHtml = reason ? `<p style="color:#334155;font-size:14px"><strong>Reason:</strong> ${reason}</p>` : '';
                        const html = `
                            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fef2f2;border-radius:12px">
                                <h2 style="color:#dc2626;margin:0 0 8px 0">Registration Not Approved</h2>
                                <p style="color:#334155;font-size:14px">Hello ${user.full_name},</p>
                                <p style="color:#334155;font-size:14px">Your BHW registration for the Cabuyao Disease Monitoring System was not approved at this time.</p>
                                ${reasonHtml}
                                <p style="color:#334155;font-size:14px">If you believe this is an error, please contact your local CHO office.</p>
                                <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                                <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
                            </div>`;
                        sendBrevoEmail(user.email, 'BHW Registration Not Approved - Cabuyao CDMS', html)
                            .catch(err => console.error(`Rejection email failed for user ${id}:`, err.message));
                    }

                    // Audit log: registration rejected
                    const actorId = (req.body && req.body.actor_id) || null;
                    if (actorId) {
                      db.query('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [actorId], (aErr, aRes) => {
                        if (!aErr && aRes.length > 0) {
                          const actor = aRes[0];
                          db.query('SELECT name FROM barangays WHERE id = ?', [actor.assigned_barangay_id], (bErr2, bRes2) => {
                            const actorBrgy = (!bErr2 && bRes2.length > 0) ? bRes2[0].name : null;
                            createAuditLog(actorId, actor.full_name, actor.role, getChoUnitForBarangay(actorBrgy), actorBrgy,
                              'Rejected', 'User Registration',
                              `Rejected BHW registration for ${user.full_name}${reason ? ` — Reason: ${reason}` : ''} (User ID: ${user.user_id})`);
                          });
                        }
                      });
                    }

                    res.json({ message: `Registration for ${user.full_name} rejected.` });
                }
            );
        }
    );
});

// ==========================================
// PASSWORD RECOVERY ROUTES
// ==========================================

app.post('/api/forgot-password', (req, res) => {
    const { identity } = req.body;

    if (!identity) {
        return res.status(400).json({ error: 'Identity is required.' });
    }

    const findUserQuery = 'SELECT * FROM users WHERE email = ? OR mobile_number = ? OR username = ?';
    
    db.query(findUserQuery, [identity, identity, identity], (err, results) => {
        if (err) {
            console.error("DB lookup error:", err.message);
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No account found with those details.' });
        }

        const userFound = results[0];

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

            const resetLink = `${FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(userFound.email)}`;

            const mailOptions = {
                from: `"Cabuyao Health System" <${process.env.BREVO_FROM}>`,
                to: userFound.email,
                subject: 'Cabuyao Health - Password Reset Request',
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
                console.log(`Email sent to: ${userFound.email}`);
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
        const hashedReset = bcrypt.hashSync(newPassword, 10);
        db.query(clearAndSave, [hashedReset, email], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to save new password.' });
            return res.status(200).json({ message: 'Password updated successfully!' });
        });
    });
});

// ==========================================
// USER MANAGEMENT ROUTES (Admin panel)
// ==========================================

// ROUTE: Admin-create a user account
app.post('/api/users', requireRole('CHO'), async (req, res) => {
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

    const hashedFinal = bcrypt.hashSync(finalPassword, 10);
    db.query(insertQuery, [username, fullName, email, mobile || null, hashedFinal, finalPassword, role || 'BHW', barangayId, isActive ? 1 : 0], (err, result) => {
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

        console.log("User added:", { username, fullName, barangayId });
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

            const verifyLink = `${FRONTEND_URL}/verify-2fa?token=${token}&userId=${userId}`;

            try {
                await sendBrevoEmail(user.email, 'Cabuyao Health - Verify Your Email for 2FA', `
                <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#16171d;border:1px solid #2e303a;border-radius:8px;overflow:hidden;">
                    <div style="background:#0d9488;padding:24px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:28px;">CABUYAO HEALTH</h1>
                    </div>
                    <div style="background:#1f2028;padding:40px 32px;">
                        <p style="color:#f3f4f6;font-size:16px;">Hi ${user.full_name},</p>
                        <p style="color:#f3f4f6;font-size:16px;">You requested to enable Two-Factor Authentication on your account.</p>
                        <div style="text-align:center;margin:32px 0;">
                            <a href="${verifyLink}" style="background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;font-size:16px;font-weight:bold;border-radius:6px;display:inline-block;"> Verify Email</a>
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
                await sendBrevoEmail(user.email, 'Cabuyao Health - Your Login Verification Code', `
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
function createNotificationForUsers(title, message, type, link_to, barangayId = null, eventType = null, choUnit = null, referenceId = null) {

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
                        weekly_summary: false, system_maintenance: false, updated_case_reported: false,
                    };
                    if (!prefErr && prefRows.length > 0) {
                        prefs = { ...prefs, ...prefRows[0] };
                    }

                    // Determine if this event is allowed by user preferences
                    const eventAllowed = !eventType || eventType === 'delete' || prefs[eventType] == true;

                    // 1. In-app notification (Push) — only if push_notifications is ON
                    if (prefs.push_notifications && eventAllowed) {
                        db.query(
                            'INSERT INTO notifications (user_id, title, message, type, link_to, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
                            [user.user_id, title, message, type, link_to, referenceId],
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
        
        if (activeCount >= 20) {
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
                weekly_summary: false, system_maintenance: false, updated_case_reported: false,
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
        weekly_summary, system_maintenance, updated_case_reported,
    } = req.body;

    db.query(
        `INSERT INTO notification_preferences 
        (user_id, push_notifications, email_notifications, sms_notifications, 
         new_case_reported, case_status_updated, high_risk_alert, 
         weekly_summary, system_maintenance, updated_case_reported)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        push_notifications = VALUES(push_notifications),
        email_notifications = VALUES(email_notifications),
        sms_notifications = VALUES(sms_notifications),
        new_case_reported = VALUES(new_case_reported),
        case_status_updated = VALUES(case_status_updated),
        high_risk_alert = VALUES(high_risk_alert),
        weekly_summary = VALUES(weekly_summary),
        system_maintenance = VALUES(system_maintenance),
        updated_case_reported = VALUES(updated_case_reported)`,
        [userId,
         push_notifications ? 1 : 0, email_notifications ? 1 : 0, sms_notifications ? 1 : 0,
         new_case_reported ? 1 : 0, case_status_updated ? 1 : 0, high_risk_alert ? 1 : 0,
         weekly_summary ? 1 : 0, system_maintenance ? 1 : 0, updated_case_reported ? 1 : 0],
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

          db.query('SELECT * FROM disease_categories', (err, disease_categories) => {
            if (err) return res.status(500).json({ error: err.message });
            results.disease_categories = disease_categories;

            db.query('SELECT * FROM disease_category_items', (err, disease_category_items) => {
              if (err) return res.status(500).json({ error: err.message });
              results.disease_category_items = disease_category_items;

              results.backup_date = new Date().toISOString();
              results.system = 'Cabuyao CDMS';
              results.version = '1.1';

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Content-Disposition',
                `attachment; filename=CDMS_Backup_${new Date().toISOString().split('T')[0]}.json`);
              res.json(results);
            });
          });
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
          const hashedReset = bcrypt.hashSync(resetPassword, 10);
          db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedReset, id], (updateErr) => {
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
              sendBrevoEmail(user.email, 'Account Data Cleared - Cabuyao CDMS', htmlContent)
                .catch(err => console.error('Clear-data email failed:', err.message));
            }

            console.log(`Cleared personal data for user ${id} (${user.username}) - password reset to original`);
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
  const { name, targetCho, disease, message, age, gender, contact, address } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  const detectedBarangay = detectBarangayFromAddress(address);
  db.query(
    `INSERT INTO contact_messages (name, target_cho_unit, disease_name, message, age, gender, contact_no, address, barangay)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, targetCho || null, disease || null, message, age || null, gender || null, contact || null, address || null, detectedBarangay],
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

      console.log(`Contact message from ${name}`);
      res.status(200).json({ message: 'Message sent successfully!' });
    }
  );
});

// GET /api/contact-messages — Retrieve contact messages (for CHO/BHW inbox)
app.get('/api/contact-messages', (req, res) => {
  const { choUnit, barangay, limit } = req.query;
  let sql = 'SELECT * FROM contact_messages';
  const params = [];
  const conditions = [];

  if (choUnit) {
    conditions.push('target_cho_unit = ?');
    params.push(choUnit);
  }

  if (barangay) {
    conditions.push('barangay = ?');
    params.push(barangay);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
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

// PUT /api/contact-messages/:id/pending — Mark message as pending (BHW reviewing)
app.put('/api/contact-messages/:id/pending', (req, res) => {
  db.query("UPDATE contact_messages SET status = 'pending' WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Message marked as pending.' });
  });
});

// PUT /api/contact-messages/:id/reject — Reject a resident message
app.put('/api/contact-messages/:id/reject', (req, res) => {
  db.query("UPDATE contact_messages SET status = 'rejected', is_read = 1 WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Message rejected.' });
  });
});

// PUT /api/contact-messages/:id/accept — Convert contact message to a disease case
app.put('/api/contact-messages/:id/accept', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM contact_messages WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found.' });
    const msg = rows[0];

    db.query('SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)', [msg.disease_name || ''], (dErr, dRes) => {
      const diseaseId = dRes && dRes.length > 0 ? dRes[0].id : null;
      db.query(
        `INSERT INTO disease_cases
         (patient_name, disease_id, age, severity, gender, status, contact, onset_date, address, symptoms, date_reported)
         VALUES (?, ?, ?, 'Mild', ?, 'Active', ?, NULL, ?, ?, NOW())`,
        [msg.name, diseaseId, msg.age || 0, msg.gender || 'Male', msg.contact_no || null, msg.address || null, msg.message || ''],
        (insertErr, result) => {
          if (insertErr) {
            console.error('Contact message accept insert error:', insertErr.message);
            return res.status(500).json({ error: insertErr.message });
          }
          const caseId = result.insertId;
          db.query("UPDATE contact_messages SET status = 'accepted', is_read = 1 WHERE id = ?", [id], (updateErr) => {
            if (updateErr) {
              console.error('Contact message accept update error:', updateErr.message);
              return res.status(500).json({ error: updateErr.message });
            }
            res.json({ message: 'Message accepted as case.', case_id: caseId });
          });
        }
      );
    });
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

// GET /api/disease_cases/public-disease-counts — Per-disease case counts for a barangay
app.get('/api/disease_cases/public-disease-counts', (req, res) => {
  const { barangay } = req.query;
  let sql, params;
  if (barangay) {
    sql = `SELECT d.name AS disease_name, COUNT(dc.case_id) AS case_count
           FROM diseases d
           LEFT JOIN disease_cases dc ON dc.disease_id = d.id
           LEFT JOIN barangays b ON dc.barangay_id = b.id
           WHERE b.name = ?
           GROUP BY d.id, d.name ORDER BY case_count DESC`;
    params = [barangay];
  } else {
    sql = `SELECT d.name AS disease_name, COUNT(dc.case_id) AS case_count
           FROM diseases d
           LEFT JOIN disease_cases dc ON dc.disease_id = d.id
           GROUP BY d.id, d.name ORDER BY case_count DESC`;
    params = [];
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ==========================================
// 7. SCHEDULED JOBS
// ==========================================

// ==========================================
// 7b. WEEKLY SUMMARY REPORT ENDPOINT
// ==========================================

// GET /api/weekly-summary?user_id=...&start_date=...&end_date=...
app.get('/api/weekly-summary', (req, res) => {
    const { user_id, start_date, end_date } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const sd = start_date || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const ed = end_date || new Date().toISOString().slice(0, 10);

    // 1. Determine user scope
    db.query(
        `SELECT u.user_id, u.role, u.full_name, u.assigned_barangay_id, b.name AS barangay_name
         FROM users u LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
         WHERE u.user_id = ?`, [user_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

            const user = rows[0];
            let barangayNames, scopeLabel;
            if (user.role === 'CHO') {
                const unit = getChoUnitForBarangay(user.barangay_name);
                if (!unit) return res.status(400).json({ error: 'CHO unit not found' });
                barangayNames = CHO_UNIT_BARANGAYS[unit];
                scopeLabel = unit;
            } else if (user.role === 'BHW' && user.barangay_name) {
                barangayNames = [user.barangay_name];
                scopeLabel = user.barangay_name;
            } else {
                return res.status(400).json({ error: 'Cannot determine user scope' });
            }

            const ph = barangayNames.map(() => '?').join(',');

            const doQuery = (sql, params) => new Promise((resolve, reject) =>
                db.query(sql, params, (e, r) => e ? reject(e) : resolve(r))
            );

            // 2. Run all queries in parallel
            const summarySQL = `
                SELECT
                    COUNT(*) AS total_cases,
                    SUM(CASE WHEN dc.date_reported >= ? THEN 1 ELSE 0 END) AS new_this_week,
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

            const newCasesSQL = `
                SELECT dc.case_id, dc.patient_name, dc.age, dc.gender, dc.severity, dc.status,
                       dc.date_reported, d.name AS disease_name, b.name AS barangay_name
                FROM disease_cases dc
                JOIN barangays b ON dc.barangay_id = b.id
                JOIN diseases d ON dc.disease_id = d.id
                WHERE b.name IN (${ph}) AND dc.date_reported >= ?
                ORDER BY dc.date_reported DESC`;

            const auditSQL = `
                SELECT al.*, u.full_name AS user_full_name
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.user_id
                WHERE (al.barangay IN (${ph}) OR al.cho_unit = ?)
                  AND al.created_at >= ? AND al.created_at <= DATE_ADD(?, INTERVAL 1 DAY)
                ORDER BY al.created_at DESC
                LIMIT 50`;

            // ── Week-over-week comparison: same-length window immediately before ──
            const sdDate = new Date(sd + 'T00:00:00Z');
            const edDate = new Date(ed + 'T00:00:00Z');
            const durationDays = Math.max(1, Math.round((edDate - sdDate) / 86400000) + 1);
            const prevEndDate = new Date(sdDate.getTime() - 86400000);
            const prevStartDate = new Date(prevEndDate.getTime() - (durationDays - 1) * 86400000);
            const prevStartStr = prevStartDate.toISOString().slice(0, 10);
            const prevEndStr = prevEndDate.toISOString().slice(0, 10);

            const periodSQL = `
                SELECT COUNT(*) AS new_in_period
                FROM disease_cases dc
                JOIN barangays b ON dc.barangay_id = b.id
                WHERE b.name IN (${ph}) AND dc.date_reported >= ? AND dc.date_reported < DATE_ADD(?, INTERVAL 1 DAY)`;

            const params = [...barangayNames];

            Promise.all([
                doQuery(summarySQL, [sd, ...params]).then(r => r[0]),
                doQuery(barangaySQL, params),
                doQuery(diseaseSQL, params),
                doQuery(severitySQL, params),
                doQuery(newCasesSQL, [...params, sd]),
                doQuery(auditSQL, [...params, scopeLabel, sd, ed]),
                doQuery(periodSQL, [...params, sd, ed]).then(r => r[0]),
                doQuery(periodSQL, [...params, prevStartStr, prevEndStr]).then(r => r[0]),
            ]).then(([summary, barangays, diseases, severities, newCases, auditLogs, currPeriod, prevPeriod]) => {
                // ── Comparison + rate computations ──
                const currNew = currPeriod.new_in_period || 0;
                const prevNew = prevPeriod.new_in_period || 0;
                const pctChange = (curr, prev) => {
                    if (prev === 0) return curr > 0 ? 100 : 0;
                    return Math.round(((curr - prev) / prev) * 100);
                };
                const totalAll = summary.total_cases || 0;
                const recoveryRate = totalAll > 0 ? Math.round(((summary.recovered || 0) / totalAll) * 1000) / 10 : 0;
                const mortalityRate = totalAll > 0 ? Math.round(((summary.deceased || 0) / totalAll) * 1000) / 10 : 0;

                res.json({
                    scopeLabel,
                    dateRange: { start: sd, end: ed },
                    previousPeriod: { start: prevStartStr, end: prevEndStr },
                    summary: {
                        total_cases: totalAll,
                        new_this_week: summary.new_this_week || 0,
                        active_cases: summary.active_cases || 0,
                        recovered: summary.recovered || 0,
                        deceased: summary.deceased || 0,
                    },
                    comparison: {
                        newCases: { current: currNew, previous: prevNew, pct: pctChange(currNew, prevNew), up: currNew > prevNew },
                    },
                    rates: {
                        recoveryRate,
                        mortalityRate,
                    },
                    byBarangay: barangays,
                    byDisease: diseases,
                    bySeverity: severities,
                    newCases,
                    auditLogs,
                    generatedBy: user.full_name,
                    generatedAt: new Date().toISOString(),
                });
            }).catch(err => res.status(500).json({ error: err.message }));
        }
    );
});

// ── Shared weekly summary helpers (used by cron + trigger endpoint) ──
function buildWeeklyHtmlAndPlain(summary, barangays, diseases, severities, scopeLabel) {
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
    const totalAll = total || 0;
    const recoveryRate = totalAll > 0 ? Math.round((recovered / totalAll) * 1000) / 10 : 0;
    const mortalityRate = totalAll > 0 ? Math.round((deceased / totalAll) * 1000) / 10 : 0;

    const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
            <h1 style="color:#1e3a8a;font-size:22px;margin:0 0 4px 0">Weekly Summary${scopeTitle}</h1>
            <p style="color:#64748b;font-size:13px;margin:0 0 20px 0">${new Date().toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' })}</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
                <tr>
                    <td style="background:#eff6ff;padding:12px;border-radius:8px 0 0 8px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#1e3a8a">${total}</div>
                        <div style="font-size:11px;color:#64748b">Total Cases</div>
                    </td>
                    <td style="background:#fef2f2;padding:12px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#dc2626">${newWeek}</div>
                        <div style="font-size:11px;color:#64748b">New This Week</div>
                    </td>
                    <td style="background:#fffbeb;padding:12px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#d97706">${active}</div>
                        <div style="font-size:11px;color:#64748b">Active</div>
                    </td>
                </tr>
                <tr>
                    <td colspan="3" style="height:6px"></td>
                </tr>
                <tr>
                    <td style="background:#f0fdf4;padding:12px;border-radius:8px 0 0 8px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#16a34a">${recovered}</div>
                        <div style="font-size:11px;color:#64748b">Recovered</div>
                    </td>
                    <td colspan="2" style="background:#fef2f2;padding:12px;border-radius:0 8px 8px 0;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#991b1b">${deceased}</div>
                        <div style="font-size:11px;color:#64748b">Deceased</div>
                    </td>
                </tr>
            </table>
            <p style="color:#475569;font-size:13px;margin:0 0 20px 0;text-align:center">Recovery Rate: <strong style="color:#16a34a">${recoveryRate}%</strong> &nbsp;·&nbsp; Mortality Rate: <strong style="color:#dc2626">${mortalityRate}%</strong></p>
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

// Weekly Summary — every Monday at 8:00 AM (scoped per user / CHO unit / BHW barangay)
cron.schedule('0 17 * * 5', () => {
    console.log('⏰ Running weekly summary cron job (Friday 5PM)...');

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

    function sendToUsers(users, html, plain) {
        users.forEach(user => {
            db.query(
                'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                [user.user_id, '📊 Weekly Summary', plain, 'weekly_summary', 'Weekly Summary']
            );
            if (user.email) {
                sendBrevoEmail(user.email, '📊 Weekly Summary - Cabuyao CDMS', html)
                    .catch(err => console.error(`Weekly summary email failed for ${user.user_id}:`, err.message));
            }
            // SMS delivery for users with sms_notifications enabled + mobile number on file
            if (user.sms_notifications === 1 && user.mobile_number) {
                const smsBody = plain.length > 400 ? plain.slice(0, 397) + '...' : plain;
                sendSMS(formatPhone(user.mobile_number), smsBody)
                    .catch(err => console.error(`Weekly summary SMS failed for ${user.user_id}:`, err.message));
            }
        });
    }

    // 1. Fetch all eligible users with scope info
    db.query(
        `SELECT u.user_id, u.role, u.assigned_barangay_id, b.name AS barangay_name, u.email, u.full_name, u.mobile_number,
                np.sms_notifications
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
                    const { html, plain } = buildWeeklyHtmlAndPlain(...results, group.scopeLabel);
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
                `INSERT IGNORE INTO diseases (id, name, icon, color, description) VALUES (?, ?, ?, ?, ?)`,
                [d.id, d.name, d.icon || null, d.color || null, d.description || null],
                (err) => { if (err) console.error('Restore disease error:', err.message); done++; if (done >= backup.diseases.length) callback(); }
            );
        });
    };

    const restoreCategories = (callback) => {
        const restoreItems = (items, afterItems) => {
            if (!items || items.length === 0) return afterItems();
            let done = 0;
            items.forEach(it => {
                db.query(
                    'INSERT IGNORE INTO disease_category_items (category_id, disease_id) VALUES (?, ?)',
                    [it.category_id, it.disease_id],
                    (err) => { if (err) console.error('Restore category item error:', err.message); done++; if (done >= items.length) afterItems(); }
                );
            });
        };
        const cats = backup.disease_categories || [];
        if (cats.length === 0) return restoreItems(backup.disease_category_items, callback);
        let done = 0;
        cats.forEach(c => {
            db.query(
                `INSERT IGNORE INTO disease_categories (id, name, icon, color, description) VALUES (?, ?, ?, ?, ?)`,
                [c.id, c.name, c.icon || null, c.color || null, c.description || null],
                (err) => { if (err) console.error('Restore category error:', err.message); done++; if (done >= cats.length) restoreItems(backup.disease_category_items, callback); }
            );
        });
    };

    restoreDiseases(() => {
        restoreBarangays(() => {
            restoreUsers(() => {
                restoreDiseaseCases(() => {
                    restoreCategories(() => {
                        console.log(' Restore completed from backup dated ' + backup.backup_date);
                        res.json({ message: 'Restore completed successfully.' });
                    });
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
            disease_categories: backup.disease_categories?.length || 0,
            disease_category_items: backup.disease_category_items?.length || 0,
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