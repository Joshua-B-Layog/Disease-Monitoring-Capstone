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
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const geoSnap = require('./geoSnap');
geoSnap.loadPolygons();

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

// Normalize a Philippine phone number to international +63 format for Brevo SMS.
function toPhMobile(number) {
  if (!number) return null;
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 10 && digits[0] === '9') return '+63' + digits;
  if (digits.length === 11 && digits[0] === '0') return '+63' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('63')) return '+63' + digits.slice(2);
  return null;
}

// Staff-only emergency SMS via Brevo Transactional SMS (sender name 'Cabuyao').
async function sendBrevoSms(to, content) {
  const fullContent = 'Cabuyao CDMS: ' + content;
  const sms = fullContent.length > 160 ? fullContent.slice(0, 157) + '...' : fullContent;
  try {
    await axios.post('https://api.brevo.com/v3/transactionalSMS/sms', {
      type: 'transactional',
      sender: 'Cabuyao',
      recipient: to,
      content: sms,
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      }
    });
    console.log(`SMS sent to: ${to}`);
  } catch (err) {
    console.error('Brevo SMS API error:', err.response?.data || err.message);
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

// ── Case payload validation (minimize encoding errors - mirrors frontend checks) ──
const PH_MOBILE_RE = /^(?:\+?63|0)9\d{9}$/;
const PH_LANDLINE_RE = /^(?:\+?632|02)\d{7,8}$/;
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_SEVERITIES = ['Asymptomatic', 'Mild', 'Moderate', 'Severe', 'Critical'];
const VALID_CASE_STATUSES = ['Active', 'Pending', 'Under Treatment', 'Recovered', 'Deceased', 'Draft'];

// ── Disease classification: notification timing + case type ──
// notif_type: 'immediate' → report within 24h to CHO / surveillance (Level 1 IDSR);
//             'weekly'    → included in the consolidated weekly summary (Level 2 FHSIS).
// case_type:  'probable' → clinically consistent, awaiting/without lab confirmation;
//             'confirmed' → laboratory-confirmed.
// Defaults are best-practice (Philippine IDSR / FHSIS) and can be adjusted per
// disease via the "Add Disease" classification dropdowns or the DB constant below.
const DISEASE_CLASSIFICATIONS = {
  'Avian Influenza': { notif_type: 'immediate', case_type: 'probable' },
  'Cholera': { notif_type: 'immediate', case_type: 'confirmed' },
  'Covid-19': { notif_type: 'immediate', case_type: 'confirmed' },
  'Dengue': { notif_type: 'immediate', case_type: 'probable' },
  'Diphtheria': { notif_type: 'immediate', case_type: 'probable' },
  'Ebola': { notif_type: 'immediate', case_type: 'probable' },
  'HIV/AIDS': { notif_type: 'immediate', case_type: 'confirmed' },
  'Influenza A': { notif_type: 'immediate', case_type: 'probable' },
  'Leptospirosis': { notif_type: 'immediate', case_type: 'probable' },
  'Measles': { notif_type: 'immediate', case_type: 'probable' },
  'Meningococcemia': { notif_type: 'immediate', case_type: 'probable' },
  'Pertussis': { notif_type: 'immediate', case_type: 'probable' },
  'Poliomyelitis': { notif_type: 'immediate', case_type: 'probable' },
  'Rabies': { notif_type: 'immediate', case_type: 'probable' },
  'SARS': { notif_type: 'immediate', case_type: 'probable' },
  'Tuberculosis': { notif_type: 'weekly', case_type: 'confirmed' },
  'Typhoid Fever': { notif_type: 'weekly', case_type: 'confirmed' },
  'Acute Respiratory Infection': { notif_type: 'weekly', case_type: 'probable' },
  'Chickenpox': { notif_type: 'weekly', case_type: 'probable' },
  'Diarrhea': { notif_type: 'weekly', case_type: 'probable' },
  'Hand Foot and Mouth Disease': { notif_type: 'weekly', case_type: 'probable' },
  'Hepatitis A': { notif_type: 'weekly', case_type: 'confirmed' },
  'Hepatitis B': { notif_type: 'weekly', case_type: 'confirmed' },
  'Hepatitis C': { notif_type: 'weekly', case_type: 'confirmed' },
  'Influenza': { notif_type: 'weekly', case_type: 'probable' },
  'Leprosy': { notif_type: 'weekly', case_type: 'confirmed' },
  'Malaria': { notif_type: 'weekly', case_type: 'confirmed' },
  'Sore Eyes': { notif_type: 'weekly', case_type: 'probable' },
};
// Helper to fetch a disease's classification (with sensible fallbacks).
function diseaseClassification(name) {
  const key = String(name || '').trim();
  const cls = DISEASE_CLASSIFICATIONS[key] ||
    DISEASE_CLASSIFICATIONS[Object.keys(DISEASE_CLASSIFICATIONS).find(k => k.toLowerCase() === key.toLowerCase())];
  return { notif_type: (cls && cls.notif_type) || 'weekly', case_type: (cls && cls.case_type) || 'probable' };
}

function validateCasePayload(payload = {}) {
  const errors = [];
  const {
    patient_name, age, gender, contact, onset_date, severity, case_status, status, disease_name, case_type,
  } = payload;
  const st = case_status || status || 'Active';

  if (patient_name === undefined || patient_name === null || !String(patient_name).trim()) {
    errors.push('Patient name is required.');
  } else if (String(patient_name).trim().length < 2) {
    errors.push('Patient name must be at least 2 characters.');
  }
  if (!disease_name) errors.push('Disease is required.');

  if (age !== undefined && age !== null && age !== '') {
    const a = Number(age);
    if (!Number.isInteger(a) || String(age).trim() === '' || a < 0 || a > 130) {
      errors.push('Age must be a whole number between 0 and 130.');
    }
  }
  if (gender !== undefined && gender !== null && gender !== '' && !VALID_GENDERS.includes(gender)) {
    errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}.`);
  }
  if (severity !== undefined && severity !== null && severity !== '' && !VALID_SEVERITIES.includes(severity)) {
    errors.push(`Severity must be one of: ${VALID_SEVERITIES.join(', ')}.`);
  }
  if (st && !VALID_CASE_STATUSES.includes(st)) {
    errors.push(`Status must be one of: ${VALID_CASE_STATUSES.join(', ')}.`);
  }
  if (contact !== undefined && contact !== null && String(contact).trim()) {
    const c = String(contact).trim().replace(/[\s-]/g, '');
    if (!PH_MOBILE_RE.test(c) && !PH_LANDLINE_RE.test(c)) {
      errors.push('Contact number must be a valid Philippine number (e.g. 09171234567).');
    }
  }
  if (onset_date !== undefined && onset_date !== null && onset_date !== '') {
    const od = new Date(onset_date);
    if (isNaN(od.getTime())) {
      errors.push('Onset date is invalid.');
    } else {
      const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
      if (od.getTime() > endOfToday.getTime()) errors.push('Onset date cannot be in the future.');
    }
  }
  if (case_type !== undefined && case_type !== null && case_type !== '' && !['Suspected', 'Probable', 'Confirmed'].includes(case_type)) {
    errors.push(`Case type must be one of: Suspected, Probable, Confirmed.`);
  }
  return errors;
}

// Password policy: minimum complexity for all staff accounts
// Optional denyTokens: substrings the password must NOT contain (e.g. first name, last name, role label).
function validatePasswordStrength(password, denyTokens = []) {
  const pw = String(password || '');
  const errors = [];
  if (pw.length < 8) errors.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(pw)) errors.push('Password must include an uppercase letter.');
  if (!/[a-z]/.test(pw)) errors.push('Password must include a lowercase letter.');
  if (!/[0-9]/.test(pw)) errors.push('Password must include a number.');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Password must include a special character (e.g. !@#$%).');
  const lowerPw = pw.toLowerCase();
  const hit = denyTokens
    .filter(t => String(t || '').trim().length >= 2)
    .some(t => lowerPw.includes(String(t).toLowerCase().trim()));
  if (hit) errors.push('Password must not contain your name or role designation.');
  return errors;
}

// Strong temporary password generator: meets the same policy as user-set passwords.
function generateStrongTempPassword(len = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%';
  const all = upper + lower + numbers + special;
  const random = (max) => crypto.randomInt(0, max);
  const parts = [upper[random(upper.length)], lower[random(lower.length)], numbers[random(numbers.length)], special[random(special.length)]];
  for (let i = 4; i < len; i++) parts.push(all[random(all.length)]);
  for (let i = parts.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}

// Minimal in-memory rate limiter (per key, sliding window)
const rateLimitBuckets = {};
function simpleRateLimit(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateLimitBuckets[key];
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets[key] = { count: 1, resetAt: now + windowMs };
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }
  bucket.count += 1;
  return { allowed: bucket.count <= max, remaining: Math.max(0, max - bucket.count), retryAfterMs: bucket.resetAt - now };
}

const app = express();

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Resolve the frontend base URL for links placed in emails (2FA verify, password reset).
// Prefers the FRONTEND_URL env var; otherwise derives it from the request's Origin/Referer so
// emails always point to the live frontend (e.g. Vercel) instead of falling back to localhost.
function resolveFrontendUrl(req) {
  if (process.env.FRONTEND_URL) return FRONTEND_URL;
  const origin = (req.headers && (req.headers.origin || req.headers.referer)) || '';
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin.replace(/\/$/, '');
    }
  } catch (e) { /* not a valid URL - fall through */ }
  return 'http://localhost:3000';
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('⚠ WARNING: JWT_SECRET is not set. Using an insecure development secret. Set JWT_SECRET in your environment.');
}

// Password brute-force lockout policy: 5 failed attempts -> locked for 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

// Warn at boot if BREVO_API_KEY doesn't look like a valid Brevo API key (xkeysib-<64 hex>-<suffix>)
if (process.env.BREVO_API_KEY) {
  const brevoKey = process.env.BREVO_API_KEY.trim();
  const brevoKeyOk = /^xkeysib-[0-9a-fA-F]{64}-[A-Za-z0-9]{8,}$/.test(brevoKey);
  if (!brevoKeyOk) {
    console.warn('⚠ WARNING: BREVO_API_KEY does not look like a valid Brevo API key (expected xkeysib-<64 hex>-<suffix>). Email delivery via Brevo will fail until it is fixed.');
  }
}

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser calls (curl, health checks, server-to-server)
    let host;
    try { host = new URL(origin).hostname.toLowerCase(); } catch (e) { return cb(null, false); }
    const base = (process.env.FRONTEND_URL || '')
      .replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    const ok =
      host === base ||
      host.endsWith('.vercel.app') ||    // any Vercel deployment/preview URL (incl. Deployments tab)
      host.endsWith('.railway.app') ||   // backend preview URLs
      host === 'localhost' || host.startsWith('127.');
    cb(null, ok);
  },
  credentials: true,
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

db.on('error', (err) => {
    console.error('MySQL pool error:', err.message);
});

// -- Transaction helper (ACID) --
// withTransaction(work, onError): work(t) runs with t.q() on a dedicated connection;
// t.commit(cb) commits (releasing the connection), t.rollback() aborts. DB writes inside
// work() are atomic � any failure aborts the whole batch.
function withTransaction(work, onError) {
    pool.getConnection((connErr, conn) => {
        if (connErr) return onError(connErr);
        conn.beginTransaction((beginErr) => {
            if (beginErr) { conn.release(); return onError(beginErr); }
            const t = {
                conn,
                q: (sql, params, cb) => conn.query(sql, params, cb),
                commit: (cb) => conn.commit((cErr) => {
                    conn.release();
                    if (cErr) { cb && cb(cErr); } else { cb && cb(null); }
                }),
                rollback: () => {
                    try { conn.rollback(() => conn.release()); } catch (e) { conn.release(); }
                },
            };
            work(t);
        });
    });
}

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

// Add login_otp_attempts column to users table if missing (2FA brute-force guard)
db.query("SHOW COLUMNS FROM users LIKE 'login_otp_attempts'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE users ADD COLUMN login_otp_attempts INT DEFAULT 0", (alterErr) => {
            if (alterErr) console.error('Migration error adding login_otp_attempts:', alterErr.message);
            else console.log('Migration: added login_otp_attempts column to users table');
        });
    }
});

// Add login_attempts + login_locked_until columns to users if missing (password brute-force lockout)
db.query("SHOW COLUMNS FROM users LIKE 'login_attempts'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE users ADD COLUMN login_attempts INT DEFAULT 0, ADD COLUMN login_locked_until DATETIME DEFAULT NULL", (alterErr) => {
            if (alterErr) console.error('Migration error adding login_attempts/login_locked_until:', alterErr.message);
            else console.log('Migration: added login_attempts/login_locked_until columns to users table');
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

// Migration: prevention/symptom/video columns for the Prevention Tips feature
db.query("SHOW COLUMNS FROM diseases LIKE 'prevention_tips'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE diseases ADD COLUMN prevention_tips TEXT NULL, ADD COLUMN symptoms TEXT NULL, ADD COLUMN video_url VARCHAR(255) NULL", (alterErr) => {
            if (alterErr) console.error('Migration error adding prevention columns:', alterErr.message);
            else console.log('Migration: added prevention_tips/symptoms/video_url columns to diseases table');
        });
    }
});

// Migration: 'active' flag on diseases (soft hide from Resident portal only)
db.query("SHOW COLUMNS FROM diseases LIKE 'active'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE diseases ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1", (alterErr) => {
            if (alterErr) console.error('Migration error adding active column:', alterErr.message);
            else console.log('Migration: added active column to diseases table');
        });
    }
});

// Migration: notif_type (immediate/weekly) + case_type (probable/confirmed) classification columns
db.query("SHOW COLUMNS FROM diseases LIKE 'notif_type'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE diseases ADD COLUMN notif_type VARCHAR(10) NOT NULL DEFAULT 'weekly', ADD COLUMN case_type VARCHAR(10) NOT NULL DEFAULT 'probable'", (alterErr) => {
            if (alterErr) console.error('Migration error adding disease classification columns:', alterErr.message);
            else console.log('Migration: added notif_type/case_type columns to diseases table');
        });
    }
});

// Backfill: apply DISEASE_CLASSIFICATIONS defaults to existing diseases (idempotent UPDATEs).
// Reclassify by name on every boot so rows that were seeded with the 'weekly' column default
// (before notif_type existed) are corrected to their authoritative Immediate/Weekly type.
db.query("SELECT id, name FROM diseases", (e, rows) => {
    if (!e && rows && rows.length) {
        rows.forEach(r => {
            const cls = diseaseClassification(r.name); // null for admin/custom diseases → leave as-is
            if (!cls) return;
            db.query("UPDATE diseases SET notif_type = ?, case_type = ? WHERE id = ?", [cls.notif_type, cls.case_type, r.id], (ue) => {
                if (ue) console.error(`Error backfilling classification for disease #${r.id}:`, ue.message);
            });
        });
        console.log(`Disease classification synced for ${rows.length} disease(s)`);
    }
});

// Migration: per-case classification columns on disease_cases (probable/confirmed/suspected + subtype text)
db.query("SHOW COLUMNS FROM disease_cases LIKE 'case_type'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE disease_cases ADD COLUMN case_type VARCHAR(10) NOT NULL DEFAULT 'probable' AFTER severity, ADD COLUMN disease_type VARCHAR(100) NULL AFTER case_type", (alterErr) => {
            if (alterErr) console.error('Migration error adding case classification columns:', alterErr.message);
            else console.log('Migration: added case_type/disease_type columns to disease_cases table');
        });
    }
});

// Migration: vaccine tracking columns on disease_cases (IT Expert: vaccine expiration follow-up)
db.query("SHOW COLUMNS FROM disease_cases LIKE 'vaccination_status'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE disease_cases ADD COLUMN vaccination_status VARCHAR(30) NULL, ADD COLUMN vaccine_expiry_date DATE NULL", (alterErr) => {
            if (alterErr) console.error('Migration error adding vaccine tracking columns:', alterErr.message);
            else console.log('Migration: added vaccination_status/vaccine_expiry_date columns to disease_cases table');
        });
    }
});

// -- Read-path index migration (Phase 9): speed up the heaviest filtered queries
// Self-migrates at boot: any listed index that is missing gets created exactly once.
const REQUIRED_INDEXES = [
  ['disease_cases', 'idx_cases_barangay_status',   'barangay_id, status'],
  ['disease_cases', 'idx_cases_disease',           'disease_id'],
  ['disease_cases', 'idx_cases_onset',             'onset_date'],
  ['disease_cases', 'idx_cases_reported',          'date_reported'],
  ['disease_cases', 'idx_cases_createdby_status',  'created_by, status'],
  ['disease_cases', 'idx_cases_patient',           'patient_name'],
  ['notifications', 'idx_notif_user_read',         'user_id, is_read'],
  ['notifications', 'idx_notif_user_created',      'user_id, created_at'],
  ['audit_logs',    'idx_audit_user_created',      'user_id, created_at'],
  ['case_status_history', 'idx_status_case',       'case_id'],
  ['case_inbox',    'idx_inbox_status_unit',       'status, to_cho_unit'],
  ['case_add_requests', 'idx_addreq_status_unit',  'status, target_cho_unit'],
  ['case_edit_requests','idx_editreq_status_unit', 'status, target_cho_unit'],
  ['users',         'idx_users_email',             'email'],
  ['users',         'idx_users_username',          'username'],
];

function ensureIndexes(index, created, skipped) {
  if (index >= REQUIRED_INDEXES.length) {
    if (created > 0) console.log(`Index migration: created ${created} index(es), ${skipped} already present.`);
    else console.log(`Index check: all ${REQUIRED_INDEXES.length} read-path index(es) present.`);
    applyLocationMigrations();
    return;
  }
  const [table, name, cols] = REQUIRED_INDEXES[index];
  db.query("SHOW INDEX FROM " + table + " WHERE Key_name = ?", [name], (err, rows) => {
    if (err && err.code === 'ER_NO_SUCH_TABLE') { ensureIndexes(index + 1, created, skipped); return; }
    if (err) { console.error('Index check error on ' + table + '.' + name + ':', err.message); ensureIndexes(index + 1, created, skipped); return; }
    if (rows && rows.length > 0) { ensureIndexes(index + 1, created, skipped + 1); return; }
    db.query("CREATE INDEX " + name + " ON " + table + " (" + cols + ")",
      (cErr) => {
        if (cErr) console.error('Index migration error on ' + name + ':', cErr.message);
        else { created++; console.log('Index migration: created ' + name + ' on ' + table); }
        ensureIndexes(index + 1, created, skipped);
      });
  });
}
ensureIndexes(0, 0, 0);

// Migration: pending add requests carry the same classification columns so approval prefill + insert stay in sync
db.query("SHOW COLUMNS FROM case_add_requests LIKE 'case_type'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE case_add_requests ADD COLUMN case_type VARCHAR(10) NULL DEFAULT 'probable' AFTER severity, ADD COLUMN disease_type VARCHAR(100) NULL AFTER case_type", (alterErr) => {
            if (alterErr) console.error('Migration error adding case classification columns to case_add_requests:', alterErr.message);
            else console.log('Migration: added case_type/disease_type columns to case_add_requests table');
        });
    }
});

// Migration: disease subtype options (JSON array of strings) on diseases - powers the case-form subtype dropdown
db.query("SHOW COLUMNS FROM diseases LIKE 'subtypes'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE diseases ADD COLUMN subtypes JSON NULL", (alterErr) => {
            if (alterErr) console.error('Migration error adding subtypes column:', alterErr.message);
            else console.log('Migration: added subtypes column to diseases table');
        });
    }
});

// Seed default subtype lists for commonly surveillance-tracked diseases (idempotent per-disease)
const DISEASE_SUBTYPES_SEED = {
  'Dengue': ['Dengue Fever (without warning signs)', 'Dengue with Warning Signs', 'Severe Dengue (DHF/DSS)'],
  'Covid-19': ['Symptomatic', 'Asymptomatic', 'Mild COVID-19', 'Moderate COVID-19', 'Severe/Critical COVID-19'],
  'Influenza': ['Influenza A (H1N1)', 'Influenza A (H3N2)', 'Influenza B', 'Influenza C'],
  'Influenza A': ['H1N1', 'H3N2', 'H5N1', 'Other'],
  'Tuberculosis': ['Pulmonary TB', 'Extrapulmonary TB', 'DS-TB', 'DR-TB (MDR/XDR)'],
  'Leprosy': ['Paucibacillary (PB)', 'Multibacillary (MB)'],
  'Hepatitis A': ['Acute', 'Cholestatic', 'Fulminant'],
  'Hepatitis B': ['Acute', 'Chronic', 'Inactive Carrier'],
  'Hepatitis C': ['Acute', 'Chronic'],
  'HIV/AIDS': ['HIV (Asymptomatic)', 'HIV (Symptomatic)', 'AIDS'],
  'Malaria': ['Plasmodium falciparum', 'Plasmodium vivax', 'Plasmodium malariae', 'Plasmodium knowlesi'],
  'Rabies': ['Furious Rabies', 'Paralytic (Dumb) Rabies'],
  'Chickenpox': ['Varicella (Classic)', 'Breakthrough Varicella'],
  'Measles': ['Typical Measles', 'Modified Measles', 'Atypical Measles'],
  'Typhoid Fever': ['Uncomplicated', 'Complicated'],
  'Leptospirosis': ['Anicteric', 'Icteric (Weil\'s Disease)'],
  'Hand Foot and Mouth Disease': ['Typical HFMD', 'Atypical HFMD'],
  'Poliomyelitis': ['Acute Flaccid Paralysis (AFP)', 'Non-paralytic Polio', 'Paralytic Polio'],
};
db.query("SELECT id, name FROM diseases WHERE name IS NOT NULL", (e, rows) => {
    if (!e && rows) {
        rows.forEach(r => {
            const seed = DISEASE_SUBTYPES_SEED[r.name];
            if (!seed) return;
            db.query("SELECT subtypes FROM diseases WHERE id = ?", [r.id], (se, srows) => {
                if (se || !srows || srows.length === 0) return;
                const existing = srows[0].subtypes;
                if (existing) return;
                db.query("UPDATE diseases SET subtypes = ? WHERE id = ?", [JSON.stringify(seed), r.id], (ue) => {
                    if (ue) console.error(`Error seeding subtypes for ${r.name}:`, ue.message);
                });
            });
        });
    }
});

// Migration: is_archived flag on disease_cases (soft delete / archive instead of permanent delete)
db.query("SHOW COLUMNS FROM disease_cases LIKE 'is_archived'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE disease_cases ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER created_by", (alterErr) => {
            if (alterErr) console.error('Migration error adding is_archived:', alterErr.message);
            else console.log('Migration: added is_archived column to disease_cases table');
        });
    }
});

// Migration: must_change_password flag on users (force password change on first login)
db.query("SHOW COLUMNS FROM users LIKE 'must_change_password'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0", (alterErr) => {
            if (alterErr) console.error('Migration error adding must_change_password:', alterErr.message);
            else console.log('Migration: added must_change_password column to users table');
        });
    }
});

// Migration: is_archived flag on users (soft delete / archive instead of permanent delete)
db.query("SHOW COLUMNS FROM users LIKE 'is_archived'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE users ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0", (alterErr) => {
            if (alterErr) console.error('Migration error adding users is_archived:', alterErr.message);
            else console.log('Migration: added is_archived column to users table');
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
        db.query("SHOW COLUMNS FROM notification_preferences LIKE 'vaccine_advisories'", (e2, r2) => {
            if (!e2 && r2 && r2.length === 0) {
                db.query('ALTER TABLE notification_preferences ADD COLUMN vaccine_advisories BOOLEAN DEFAULT FALSE', (ae2) => {
                    if (ae2) console.error('Error adding vaccine_advisories column:', ae2.message);
                    else console.log('Added vaccine_advisories column to notification_preferences');
                });
            }
        });
    }
});

db.query(`CREATE TABLE IF NOT EXISTS vaccine_advisories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_key VARCHAR(20) NOT NULL,
    season_label VARCHAR(80) NOT NULL,
    month_start INT NOT NULL,
    month_end INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT,
    vaccine_recommendations TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`, (err) => {
    if (err) { console.error('Error creating vaccine_advisories table:', err.message); return; }
    db.query('SELECT COUNT(*) AS c FROM vaccine_advisories', (e2, rows) => {
        if (e2) return;
        if (rows[0].c === 0) {
            const seed = [
                ['rainy', 'Rainy Season (June - October)', 6, 10, 'Rainy Season: Prioritized Vaccines',
                 'The rainy season raises the risk of leptospirosis, typhoid, influenza and cholera. Keep these vaccines ready and rotate stock so no doses expire before use.',
                 'Anti-Leptospirosis (doxycycline prophylaxis)\nTyphoid\nInfluenza\nCholera'],
                ['dry', 'Dry Season (November - May)', 11, 5, 'Dry Season: Routine & Catch-Up Vaccines',
                 'Use the dry season for routine and catch-up immunization. Schedule outreach and use soon-to-expire stock first so vaccines do not expire unused.',
                 'Routine EPI (DPT, OPV/IPV, MMR, Hepatitis B)\nMeasles / MMR catch-up\nDeworming support\nCOVID-19 boosters']
            ];
            seed.forEach(s => {
                db.query('INSERT INTO vaccine_advisories (season_key, season_label, month_start, month_end, title, message, vaccine_recommendations) VALUES (?, ?, ?, ?, ?, ?, ?)', s);
            });
            console.log('Seeded vaccine_advisories (Rainy + Dry seasons)');
        }
    });
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
  else { console.log('Audit logs table created/verified'); backfillLegacyAuditDetails(); }
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
  // Migration: add proposed_data column to case_edit_requests (offline edits carry full proposed values)
  db.query("SHOW COLUMNS FROM case_edit_requests LIKE 'proposed_data'", (e, r) => {
    if (!e && r && r.length === 0) {
      db.query("ALTER TABLE case_edit_requests ADD COLUMN proposed_data JSON NULL", (ae) => {
        if (ae) console.error('Error adding proposed_data column to case_edit_requests:', ae.message);
        else console.log('Added proposed_data column to case_edit_requests');
      });
    }
  });
});

// Create case_add_requests table for BHW → CHO "Submit Case for Approval" workflow
db.query(`CREATE TABLE IF NOT EXISTS case_add_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(255),
  disease_name VARCHAR(100),
  age INT,
  severity VARCHAR(20),
  gender VARCHAR(10),
  case_status VARCHAR(20) DEFAULT 'Active',
  contact VARCHAR(50),
  onset_date DATE NULL,
  address TEXT,
  barangay_id INT NULL,
  symptoms TEXT,
  physician VARCHAR(255),
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  requested_by INT NOT NULL,
  requested_by_name VARCHAR(255),
  from_barangay_name VARCHAR(100),
  target_cho_unit VARCHAR(100),
  note TEXT,
  reject_reason TEXT NULL,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by INT NULL,
  case_id INT NULL,
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (barangay_id) REFERENCES barangays(id)
)`, (err) => {
  if (err) console.error('Error creating case_add_requests table:', err.message);
  else {
    console.log('Case add requests table created/verified');
    // Migration: ensure new columns exist on existing case_add_requests
    ['patient_name','disease_name','age','severity','gender','case_status','contact','onset_date','address','barangay_id','symptoms','physician','latitude','longitude','vaccination_status','vaccine_expiry_date'].forEach(col => {
      db.query("SHOW COLUMNS FROM case_add_requests LIKE ?", [col], (e, r) => {
        if (!e && r && r.length === 0) {
          const colDef =
            col === 'age' ? 'INT' :
            col === 'severity' ? 'VARCHAR(20)' :
            col === 'gender' ? 'VARCHAR(10)' :
            col === 'case_status' ? "VARCHAR(20) DEFAULT 'Active'" :
            col === 'contact' ? 'VARCHAR(50)' :
            col === 'onset_date' ? 'DATE NULL' :
            col === 'address' ? 'TEXT' :
            col === 'barangay_id' ? 'INT NULL' :
            col === 'symptoms' ? 'TEXT' :
            col === 'physician' ? 'VARCHAR(255)' :
            col === 'latitude' ? 'DECIMAL(10,8) NULL' :
            col === 'longitude' ? 'DECIMAL(11,8) NULL' :
            col === 'vaccination_status' ? 'VARCHAR(30) NULL' :
            col === 'vaccine_expiry_date' ? 'DATE NULL' :
            col === 'disease_name' ? 'VARCHAR(100)' : 'VARCHAR(255)';
          db.query(`ALTER TABLE case_add_requests ADD COLUMN ${col} ${colDef}`, (ae) => {
            if (ae) console.error(`Error adding ${col} column to case_add_requests:`, ae.message);
            else console.log(`Added ${col} column to case_add_requests`);
          });
        }
      });
    });
    // Migration: add status, resolved_by, case_id columns to case_add_requests
    db.query("SHOW COLUMNS FROM case_add_requests LIKE 'status'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE case_add_requests ADD COLUMN status ENUM('pending','accepted','rejected') DEFAULT 'pending'", (ae) => {
          if (ae) console.error('Error adding status column to case_add_requests:', ae.message);
          else console.log('Added status column to case_add_requests');
        });
      }
    });
    db.query("SHOW COLUMNS FROM case_add_requests LIKE 'resolved_by'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE case_add_requests ADD COLUMN resolved_by INT NULL", (ae) => {
          if (ae) console.error('Error adding resolved_by column to case_add_requests:', ae.message);
          else console.log('Added resolved_by column to case_add_requests');
        });
      }
    });
    db.query("SHOW COLUMNS FROM case_add_requests LIKE 'case_id'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE case_add_requests ADD COLUMN case_id INT NULL", (ae) => {
          if (ae) console.error('Error adding case_id column to case_add_requests:', ae.message);
          else console.log('Added case_id column to case_add_requests');
        });
      }
    });
    db.query("SHOW COLUMNS FROM case_add_requests LIKE 'reject_reason'", (e, r) => {
      if (!e && r && r.length === 0) {
        db.query("ALTER TABLE case_add_requests ADD COLUMN reject_reason TEXT NULL", (ae) => {
          if (ae) console.error('Error adding reject_reason column to case_add_requests:', ae.message);
          else console.log('Added reject_reason column to case_add_requests');
        });
      }
    });
  }
});

// Migration: add created_by column to disease_cases (draft authorship + approval audit)
db.query("SHOW COLUMNS FROM disease_cases LIKE 'created_by'", (err, rows) => {
    if (!err && rows.length === 0) {
        db.query("ALTER TABLE disease_cases ADD COLUMN created_by INT NULL AFTER date_reported", (alterErr) => {
            if (alterErr) console.error('Migration error adding created_by:', alterErr.message);
            else console.log('Migration: added created_by column to disease_cases table');
        });
    }
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

// Migration: add created_at column to users table (registration date for pending list)
db.query("SHOW COLUMNS FROM users LIKE 'created_at'", (e, r) => {
  if (!e && r && r.length === 0) {
    db.query("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (ae) => {
      if (ae) console.error('Error adding created_at column to users:', ae.message);
      else console.log('Added created_at column to users');
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

// User login sessions table (server-tracked for Facebook-style session management)
db.query(`CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_id VARCHAR(64) NOT NULL,
  device VARCHAR(255),
  location VARCHAR(255),
  ip VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (token_id)
)`, (err) => {
  if (err) console.error('Error creating user_sessions table:', err.message);
  else console.log('User sessions table created/verified');
});

// ═════════════════════════════════════════════════════════════
// ARCHIVE VAULT + ERROR LOG (Phase 1b / Phase 3)
// ═════════════════════════════════════════════════════════════

// Retention archive: JSON snapshots of records that were archived or deleted,
// browsable/restorable from the BarangayReports "Archive Vault" tab (CHO-only).
db.query(`CREATE TABLE IF NOT EXISTS archive_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  snapshot_name VARCHAR(255),
  data JSON NOT NULL,
  actor_id INT NULL,
  actor_name VARCHAR(255),
  actor_role VARCHAR(20),
  action VARCHAR(50) NOT NULL,
  restored_at DATETIME NULL,
  restored_by VARCHAR(255),
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_arch_entity (entity, archived_at)
)`, (err) => {
  if (err) console.error('Error creating archive_records table:', err.message);
  else console.log('Archive records table created/verified');
});

// Durable error log captured by the process-level handlers + global error middleware
db.query(`CREATE TABLE IF NOT EXISTS error_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(20) DEFAULT 'error',
  source VARCHAR(100),
  message TEXT,
  stack TEXT,
  context JSON NULL,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_err_at (logged_at)
)`, (err) => {
  if (err) console.error('Error creating error_logs table:', err.message);
  else console.log('Error logs table created/verified');
});

function logAppError(level, source, message, stack, context) {
  db.query('INSERT INTO error_logs (level, source, message, stack, context) VALUES (?, ?, ?, ?, ?)',
    [level || 'error', source || null, message || null, stack || null, context ? JSON.stringify(context) : null],
    (e) => { if (e) console.error('Error writing to error_logs:', e.message); });
}

// Snapshot any record into the retention archive.
function archiveRecord(entity, entityId, snapshotName, data, actor, action, t) {
  if (!data) return;
  const sql = 'INSERT INTO archive_records (entity, entity_id, snapshot_name, data, actor_id, actor_name, actor_role, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [entity, entityId || null, snapshotName || null, JSON.stringify(data),
     (actor && actor.id) || null, (actor && actor.name) || 'System', (actor && actor.role) || null, action || 'Archived'];
  if (t) { t.q(sql, params, (e) => { if (e) console.error('Archive record insert error:', e.message); }); return; }
  db.query(sql, params, (e) => { if (e) console.error('Archive record insert error:', e.message); });
}

function createAuditLog(userId, userName, userRole, choUnit, barangay, action, entity, details, t) {
  const sql = 'INSERT INTO audit_logs (user_id, user_name, user_role, cho_unit, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [userId || null, userName || 'System', userRole || 'System', choUnit || null, barangay || null, action, entity, details];
  const cb = (err) => { if (err) console.error('Audit log insert error:', err.message); };
  if (t) { t.q(sql, params, cb); return; }
  db.query(sql, params, cb);
}

function phTimestamp(date) {
  return (date ? new Date(date) : new Date()).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// One-time (idempotent) reformat of legacy login/logout audit details so old rows
// match the new readable PH-time format. Runs at startup; skips already-formatted rows.
function backfillLegacyAuditDetails() {
  db.query(
    "SELECT id, action, details, created_at FROM audit_logs WHERE action IN ('Logged In', 'Logged In (2FA)', 'Logged Out')",
    (err, rows) => {
      if (err) { console.error('Audit backfill select error:', err.message); return; }
      const formattedSuffix = /[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2} [AP]M$/;
      const updates = [];
      rows.forEach((r) => {
        const d = r.details || '';
        let newDetails = null;
        if (r.action === 'Logged Out') {
          if (/^Logout at \d{4}-\d{2}-\d{2}T/.test(d)) {
            newDetails = `Logout at ${phTimestamp(d.replace(/^Logout at /, ''))}`;
          } else if (!formattedSuffix.test(d)) {
            newDetails = `Logout at ${phTimestamp(r.created_at)}`;
          }
        } else if (r.action === 'Logged In' || r.action === 'Logged In (2FA)') {
          if (!formattedSuffix.test(d)) {
            newDetails = `${d} on ${phTimestamp(r.created_at)}`;
          }
        }
        if (newDetails && newDetails !== d) updates.push([newDetails, r.id]);
      });
      if (updates.length === 0) return;
      let done = 0;
      updates.forEach(([details, id]) => {
        db.query('UPDATE audit_logs SET details = ? WHERE id = ?', [details, id], (uErr) => {
          if (uErr) console.error('Audit backfill update error:', uErr.message);
          if (++done === updates.length) console.log(`Audit backfill complete: reformatted ${updates.length} login/logout row(s).`);
        });
      });
    }
  );
}

// One-time (idempotent) location repair: every disease case whose stored
// longitude/latitude falls OUTSIDE its assigned barangay polygon is re-snapped
// to an in-polygon point (same GeoJSON the maps render). Safe to re-run -
// corrected points pass the inside check on the next startup.
function resnapMisplacedCaseLocations() {
  if (!geoSnap.getGeometryForBarangay('Sala')) {
    console.log('geoSnap: polygon data unavailable - skipped case location re-snap.');
    return;
  }
  db.query(
    `SELECT dc.case_id, dc.latitude, dc.longitude, dc.address, b.name AS barangay_name
     FROM disease_cases dc
     LEFT JOIN barangays b ON dc.barangay_id = b.id
     WHERE dc.latitude IS NOT NULL AND dc.longitude IS NOT NULL AND dc.latitude <> '' AND dc.longitude <> ''`,
    (err, rows) => {
      if (err) { console.error('Re-snap select error:', err.message); return; }
      if (!rows || rows.length === 0) { console.log('geoSnap: 0 cases to re-snap.'); return; }
      const updates = [];
      rows.forEach((r) => {
        if (!r.barangay_name) return;
        const geometry = geoSnap.getGeometryForBarangay(r.barangay_name);
        if (!geometry) return;
        const pLat = geoSnap.parseCoord(r.latitude);
        const pLng = geoSnap.parseCoord(r.longitude);
        if (pLat !== null && pLng !== null && geoSnap.pointInFeature(pLng, pLat, geometry)) return;
        const unit = geoSnap.extractLocationUnit(r.address) || 'C';
        const clamped = geoSnap.snapToBarangay(r.longitude, r.latitude, r.barangay_name, `${r.barangay_name}|${unit}`);
        if (!clamped) return;
        updates.push({ id: r.case_id, lat: clamped[0], lng: clamped[1] });
      });
      if (updates.length === 0) { console.log(`geoSnap: all ${rows.length} case location(s) already inside their barangay.`); return; }
      let done = 0;
      updates.forEach((u) => {
        db.query('UPDATE disease_cases SET latitude = ?, longitude = ? WHERE case_id = ?', [String(u.lat), String(u.lng), u.id], (uErr) => {
          if (uErr) console.error('Re-snap update error (case ' + u.id + '):', uErr.message);
          if (++done === updates.length) {
            console.log(`geoSnap: re-snapped ${updates.length}/${rows.length} case location(s) into their barangay polygons.`);
            createAuditLog(null, 'System', 'System', null, null, 'Re-snapped', 'Case Locations',
              `${updates.length} case(s) had coordinates outside their assigned barangay; snapped into polygon.`);
          }
        });
      });
    }
  );
}

// Conductor for the location migrations:
//   1) enrich plain seed addresses ("Brgy. X, Cabuyao City, Laguna") with a
//      deterministic unit (Purok / Blk+Lot / Phase / Mabitac / Southville) so
//      the purok grouping and per-unit clustering actually have data to chew on;
//   2) spread stacked coordinates into per-unit scatter (fresh run, because the
//      addresses just gained units);
//   3) on later startups everything is gated: enrichment + spread are skipped
//      and the re-snap stays as a fallback for stragglers.
function applyLocationMigrations() {
  const checkSpreadGate = () => {
    db.query("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'Spread' AND entity = 'Case Locations'", (err, res) => {
      if (err) { console.error('Spread gate error:', err.message); return resnapMisplacedCaseLocations(); }
      if (res && res[0] && Number(res[0].c) > 0) {
        console.log('geoSnap: coordinate spread already applied - skipping.');
        return resnapMisplacedCaseLocations();
      }
      spreadStackedCaseLocations();
    });
  };
  db.query("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'Address Enrichment' AND entity = 'Case Locations'", (err, res) => {
    if (err) { console.error('Address enrichment gate error:', err.message); return checkSpreadGate(); }
    if (res && res[0] && Number(res[0].c) > 0) { console.log('geoSnap: address enrichment already applied - skipping.'); return checkSpreadGate(); }
    fleshOutSeedAddresses((updated) => {
      if (updated === 0) return checkSpreadGate();
      db.query("DELETE FROM audit_logs WHERE action = 'Spread' AND entity = 'Case Locations'", (delErr) => {
        if (delErr) console.error('Spread gate reset error:', delErr.message);
        checkSpreadGate();
      });
    });
  });
}

// Deterministic 0..1 value per case_id - stable across re-runs on any machine.
function enrichmentSeed(caseId) {
  const h = crypto.createHash('sha1').update('enrich:' + caseId).digest('hex').slice(0, 8);
  return parseInt(h, 16) / 0xffffffff;
}

// Pick a realistic unit for a seed case. Puroks dominate (~56%); Blk+Lot ~18%;
// Phase ~10%; the barangay's landmark development (Niugan=Mabitac Phase,
// Marinig=Southville, San Isidro=Southville 3) ~16%.
function buildEnrichmentUnit(num, barangayName) {
  const r = num;
  if (barangayName === 'Niugan') {
    if (r < 0.16) return `Mabitac Phase ${1 + Math.floor((r / 0.16) * 3)}`;
  } else if (barangayName === 'Marinig') {
    if (r < 0.16) {
      const pool = ['Southville 1A', 'Southville 1B', 'Southville 2', 'Southville 3'];
      return pool[Math.floor((r / 0.16) * pool.length)];
    }
  } else if (barangayName === 'San Isidro') {
    if (r < 0.16) return 'Southville 3';
  }
  if (r >= 0.16 && r < 0.34) {
    const blk = 1 + Math.floor(((r - 0.16) / 0.18) * 12);
    const lot = 1 + Math.floor(((r - 0.16) / 0.18) * 14);
    return `Blk ${blk} Lot ${lot}`;
  }
  if (r >= 0.34 && r < 0.44) return `Phase ${1 + Math.floor(((r - 0.34) / 0.10) * 3)}`;
  const p = 1 + Math.floor(((r - 0.44) / 0.56) * 6);
  return `Purok ${Math.min(p, 6)}`;
}

// One-time text enrichment: the seed/demo import stored bare "Brgy. X, Cabuyao
// City, Laguna" addresses with no unit, so nothing could ever cluster past the
// barangay. Rewrites them to "<Unit> Brgy. X, Cabuyao City, Laguna" using a
// per-case_id deterministic unit. Skips rows that already carry a unit and rows
// with no barangay. Writes a single 'Address Enrichment' audit row.
function fleshOutSeedAddresses(cb) {
  db.query(
    `SELECT dc.case_id, dc.address, b.name AS barangay_name
     FROM disease_cases dc
     LEFT JOIN barangays b ON dc.barangay_id = b.id
     WHERE dc.address IS NOT NULL AND dc.address <> '' AND dc.address LIKE '%Cabuyao%'`,
    (qErr, rows) => {
      if (qErr) { console.error('Address enrichment select error:', qErr.message); return cb(0); }
      if (!rows || rows.length === 0) { console.log('geoSnap: 0 addresses to enrich.'); return cb(0); }
      const hasUnit = /Purok|Prk\.?\s|Blk\.?\s|Block|Lot|Phase|Ph\.?|Mabitac|Southville|Subd/i;
      const updates = [];
      rows.forEach((r) => {
        if (!r.barangay_name) return;
        if (hasUnit.test(r.address)) return;
        updates.push({ id: r.case_id, address: `${buildEnrichmentUnit(enrichmentSeed(r.case_id), r.barangay_name)} ${r.address}` });
      });
      if (updates.length === 0) { console.log('geoSnap: no plain addresses to enrich.'); return cb(0); }
      let done = 0;
      updates.forEach((u) => {
        db.query('UPDATE disease_cases SET address = ? WHERE case_id = ?', [u.address, u.id], (uErr) => {
          if (uErr) console.error('Address enrichment update error (case ' + u.id + '):', uErr.message);
          if (++done === updates.length) {
            console.log(`geoSnap: enriched ${updates.length} seed address(es) with deterministic units.`);
            createAuditLog(null, 'System', 'System', null, null, 'Address Enrichment', 'Case Locations',
              `Seed addresses were bare ("Brgy. X, Cabuyao City, Laguna"); ${updates.length} got a deterministic Purok/Blk+Lot/Phase/Mabitac/Southville unit.`);
            cb(updates.length);
          }
        });
      });
    }
  );
}

// One-time coordinate spread: the seed/demo import stacked every case in a
// barangay onto the same coordinate; this gives each case its own deterministic,
// distinct in-polygon point (clustered by purok/blk/lot/phase when the address
// carries one). Deterministic seeds make re-runs stable no-ops, and the audit
// gate runs it once.
function spreadStackedCaseLocations() {
  db.query(
    `SELECT dc.case_id, dc.address, b.name AS barangay_name
     FROM disease_cases dc
     LEFT JOIN barangays b ON dc.barangay_id = b.id
     WHERE dc.latitude IS NOT NULL AND dc.longitude IS NOT NULL AND dc.latitude <> '' AND dc.longitude <> ''`,
        (qErr, rows) => {
          if (qErr) { console.error('Spread select error:', qErr.message); return; }
          if (!rows || rows.length === 0) { console.log('geoSnap: 0 cases to spread.'); return; }
          const updates = [];
          rows.forEach((r) => {
            if (!r.barangay_name) return;
            const geometry = geoSnap.getGeometryForBarangay(r.barangay_name);
            if (!geometry) return;
            const unit = geoSnap.extractLocationUnit(r.address) || 'C';
            const unitSeed = `${r.barangay_name}|${unit}`;
            const jitterSeed = `${unitSeed}|${r.case_id}`;
            const p = geoSnap.spreadPointInBarangay(geometry, unitSeed, jitterSeed);
            if (!p) return;
            updates.push({ id: r.case_id, lat: p[0], lng: p[1] });
          });
          if (updates.length === 0) { console.log('geoSnap: nothing to spread.'); return; }
          let done = 0;
          updates.forEach((u) => {
            db.query('UPDATE disease_cases SET latitude = ?, longitude = ? WHERE case_id = ?', [String(u.lat), String(u.lng), u.id], (uErr) => {
              if (uErr) console.error('Spread update error (case ' + u.id + '):', uErr.message);
              if (++done === updates.length) {
                console.log(`geoSnap: spread ${updates.length} case location(s) across their barangays (deterministic, in-polygon).`);
                createAuditLog(null, 'System', 'System', null, null, 'Spread', 'Case Locations',
                  `${updates.length} case(s) were stacked on shared coordinates; each got its own in-polygon point.`);
              }
            });
          });
        }
      );
}

function signToken(user, jti) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      name: user.full_name,
      barangay: user.assigned_barangay_name || null,
      jti: jti || null,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Create a user_sessions row and return the signed token bound to that session (jti).
// Used by login + verify-login-otp so every active session is server-tracked.
function createSessionAndSignToken(user, device, location, ip, cb) {
  const tokenId = crypto.randomBytes(24).toString('hex');
  db.query(
    'INSERT INTO user_sessions (user_id, token_id, device, location, ip) VALUES (?, ?, ?, ?, ?)',
    [user.user_id, tokenId, device || 'Unknown Device', location || 'Unknown Location', ip || null],
    (err) => {
      if (err) {
        console.error('[SESSION] createSessionAndSignToken insert error:', err.message);
        return cb(err, null);
      }
      cb(null, signToken(user, tokenId));
    }
  );
}

function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      user_id: payload.user_id,
      role: payload.role,
      name: payload.name,
      barangay: payload.barangay,
      token_id: payload.jti || null,
    };
    // Server-side session check: if the token carries a jti, its user_sessions row
    // must exist and not be revoked. Legacy tokens without a jti pass through.
    if (payload.jti) {
      db.query(
        'SELECT id FROM user_sessions WHERE token_id = ? AND revoked_at IS NULL',
        [payload.jti],
        (sErr, sRows) => {
          if (sErr || !sRows || sRows.length === 0) {
            createAuditLog(
              (req.user && req.user.user_id) || null,
              req.user && req.user.name ? req.user.name : 'Unknown',
              (req.user && req.user.role) || 'Unknown',
              null, null,
              'Auth Failed',
              req.originalUrl,
              `Revoked or missing session for ${req.method} ${req.originalUrl}`
            );
            return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
          }
          next();
        }
      );
      return;
    }
    next();
  } catch (err) {
    createAuditLog(
      null,
      'Unknown',
      'Unknown',
      null, null,
      'Auth Failed',
      req.originalUrl,
      `Invalid or expired token for ${req.method} ${req.originalUrl}`
    );
    return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user ? req.user.role : req.headers['x-user-role'];
    if (!userRole || !roles.includes(userRole)) {
      createAuditLog(
        (req.user && req.user.user_id) || req.headers['x-user-id'] || null,
        (req.user && req.user.name) || req.headers['x-user-name'] || 'Unknown',
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

function notifyTargetUnitCho(unit, title, msg) {
  if (!unit) return;
  db.query(
    `SELECT u.user_id, u.assigned_barangay_id, b.name AS barangay_name
     FROM users u
     LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
     WHERE u.role = 'CHO' AND u.is_active = 1`,
    (err, users) => {
      if (err || !users || users.length === 0) return;
      const recipients = users.filter(u => {
        const unitName = getChoUnitForBarangayName(u.barangay_name);
        // CHOs scoped to another unit are excluded; unscoped admins still get notified
        return !unitName || unitName === unit;
      });
      recipients.forEach(u => {
        db.query(
          'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
          [u.user_id, title, msg, 'info', 'Inbox']
        );
      });
    }
  );
}

// ==========================================
// 4. API ROUTES
// ==========================================

// ROUTE: Health check / ping for offline detection
app.get('/api/ping', (req, res) => res.sendStatus(200));

// ROUTE: Get all disease cases (with disease_name join)
app.get('/api/disease_cases', (req, res) => {
    const requesterId = req.query.user_id ? Number(req.query.user_id) : null;
    const includeArchived = req.query.include_archived === '1';
    const archiveFilter = includeArchived ? '' : ' AND dc.is_archived = 0';
    // Optional pagination (additive): pass ?limit=&offset= to cap the page size.
    // Without limit the endpoint returns the full array exactly as before.
    const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : null;
    const rawOffset = req.query.offset !== undefined ? Number(req.query.offset) : NaN;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
    const paging = limit ? ` LIMIT ${limit} OFFSET ${offset}` : '';
    const baseSql = `
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
            dc.case_type,
            dc.disease_type,
            dc.status, 
            dc.date_reported,
            dc.is_archived,
            dc.vaccination_status,
            dc.vaccine_expiry_date,
            d.name AS disease_name, 
            b.name AS barangay_name,
            dc.barangay_id
        FROM disease_cases dc
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        WHERE (dc.status != 'Draft' OR dc.created_by = ?)${archiveFilter}
        ORDER BY dc.case_id DESC`;
    db.query(baseSql + paging, [requesterId], (err, results) => {
        if (err) {
            console.error("MySQL Query Error (/api/disease_cases):", err.message);
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (!limit) return res.json(results);
        db.query('SELECT COUNT(*) AS total FROM disease_cases dc WHERE (dc.status != \'Draft\' OR dc.created_by = ?)' + archiveFilter, [requesterId], (cErr, cRes) => {
            if (cErr) return res.json(results);
            res.json({ rows: results, total: (cRes && cRes[0] && cRes[0].total) || 0, limit, offset });
        });
    });
});

// ROUTE: Create a draft case (author-private autosave; no notifications/duplicate guard/audit)
app.post('/api/disease_cases', authenticate, (req, res) => {
    const b = req.body || {};
    const pick = (...keys) => {
        for (const k of keys) if (b[k] !== undefined && b[k] !== null) return b[k];
        return undefined;
    };
    const patient_name0 = pick('patient_name', 'patientName');
    if (!patient_name0 || !String(patient_name0).trim()) {
        return res.status(400).json({ error: 'Patient name is required.' });
    }
    const draft = {
        patient_name: String(patient_name0).trim(),
        disease_name: pick('disease_name', 'diseaseType') || null,
        age: b.age || 0,
        severity: b.severity || 'Mild',
        gender: b.gender || 'Male',
        status: 'Draft',
        contact: b.contact || null,
        onset_date: pick('onset_date', 'onsetDate') || null,
        address: b.address || null,
        barangay_id: pick('barangay_id', 'barangayId') || null,
        symptoms: b.symptoms || null,
        physician: b.physician || null,
        latitude: pick('latitude', 'lat') || null,
        longitude: pick('longitude', 'lng') || null,
        case_type: pick('case_type', 'caseType') || null,
        disease_type: pick('disease_type', 'diseaseSubtype') || null,
        vaccination_status: pick('vaccination_status', 'vaccinationStatus') || null,
        vaccine_expiry_date: pick('vaccine_expiry_date', 'vaccineExpiryDate') || null,
    };
    const resolveDisease = (done) => {
        if (!draft.disease_name) return done(null, null);
        db.query('SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)', [draft.disease_name], (e, rows) => {
            if (e) return done(null, e);
            done(rows && rows.length > 0 ? rows[0].id : null, null);
        });
    };
    resolveDisease((diseaseId, errCtx) => {
        if (errCtx) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        const insertQuery = `
            INSERT INTO disease_cases
            (patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact,
             onset_date, address, barangay_id, symptoms, physician, latitude, longitude, created_by,
             vaccination_status, vaccine_expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const vals = [
            draft.patient_name, diseaseId, draft.age, draft.severity, draft.case_type, draft.disease_type,
            draft.gender, draft.contact, draft.onset_date, draft.address, draft.barangay_id,
            draft.symptoms, draft.physician, draft.latitude, draft.longitude,
            req.user.user_id || req.body.user_id || null,
            draft.vaccination_status, draft.vaccine_expiry_date,
        ];
        db.query(insertQuery, vals, (err, result) => {
            if (err) {
                console.error('Draft create error:', err.message);
                return res.status(500).json({ error: 'Failed to save draft. Please try again.' });
            }
            res.status(201).json({ message: 'Draft saved', case_id: result.insertId });
        });
    });
});

// ROUTE: Update an author's own draft case (autosave)
app.put('/api/disease_cases/:id', authenticate, (req, res) => {
    const caseId = req.params.id;
    const b = req.body || {};
    const pick = (...keys) => {
        for (const k of keys) if (b[k] !== undefined && b[k] !== null) return b[k];
        return undefined;
    };
    db.query('SELECT case_id, status, created_by FROM disease_cases WHERE case_id = ?', [caseId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Case not found.' });
        const row = rows[0];
        const ownerId = req.user.user_id;
        if (row.status !== 'Draft') {
            return res.status(403).json({ error: 'Only drafts can be edited this way.' });
        }
        if (row.created_by && ownerId && row.created_by !== ownerId) {
            return res.status(403).json({ error: 'You can only edit your own drafts.' });
        }
        const cols = {
            patientName: 'patient_name', disease_name: 'disease_id', patient_name: 'patient_name',
            age: 'age', severity: 'severity', gender: 'gender', contact: 'contact',
            onsetDate: 'onset_date', onset_date: 'onset_date', address: 'address',
            barangayId: 'barangay_id', barangay_id: 'barangay_id', symptoms: 'symptoms',
            physician: 'physician', lat: 'latitude', latitude: 'latitude', lng: 'longitude',
            longitude: 'longitude', caseType: 'case_type', case_type: 'case_type',
            diseaseSubtype: 'disease_type', disease_type: 'disease_type',
            vaccinationStatus: 'vaccination_status', vaccination_status: 'vaccination_status',
            vaccineExpiryDate: 'vaccine_expiry_date', vaccine_expiry_date: 'vaccine_expiry_date',
        };
        const sets = [];
        const vals = [];
        const seen = new Set();
        let hasDiseaseName = false;
        for (const [key, col] of Object.entries(cols)) {
            if (seen.has(col)) continue;
            seen.add(col);
            const v = pick(key);
            if (v === undefined) continue;
            if (key === 'age') { sets.push(`${col} = ?`); vals.push(Number(v) || 0); }
            else if (v === null && (col === 'case_type' || col === 'disease_type')) { sets.push(`${col} = NULL`); }
            else { sets.push(`${col} = ?`); vals.push(v); }
        }
        const diseaseName = pick('disease_name', 'diseaseType');
        if (diseaseName) hasDiseaseName = true;
        const finishUpdate = (diseaseId) => {
            if (diseaseId) { sets.push('disease_id = ?'); vals.push(diseaseId); }
            if (sets.length === 0) return res.json({ message: 'Draft unchanged' });
            db.query(`UPDATE disease_cases SET ${sets.join(', ')} WHERE case_id = ?`, [...vals, caseId], (uErr) => {
                if (uErr) {
                    console.error('Draft update error:', uErr.message);
                    return res.status(500).json({ error: 'Failed to save draft. Please try again.' });
                }
                res.json({ message: 'Draft saved' });
            });
        };
        if (hasDiseaseName) {
            db.query('SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)', [diseaseName], (e, rowD) => {
                if (e) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
                finishUpdate(rowD && rowD.length > 0 ? rowD[0].id : null);
            });
        } else {
            finishUpdate(null);
        }
    });
});

// ROUTE: Lookup patient by name/surname for auto-fill
app.get('/api/patients/lookup', authenticate, (req, res) => {
  const { name } = req.query;
  if (!name || name.trim().length < 2) {
    return res.json([]);
  }
  const searchTerm = `%${name.trim()}%`;
  const sql = `
    SELECT dc1.case_id, dc1.patient_name, dc1.age, dc1.gender, dc1.contact,
           dc1.address, dc1.barangay_id, b.name AS barangay_name,
           dc1.symptoms, dc1.physician, dc1.latitude, dc1.longitude,
           dc1.date_reported, dc1.status, d.name AS disease_name
    FROM disease_cases dc1
    LEFT JOIN barangays b ON dc1.barangay_id = b.id
    LEFT JOIN diseases d ON dc1.disease_id = d.id
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
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    res.json(results);
  });
});

// ROUTE: Get list of diseases
app.get('/api/diseases', (req, res) => {
    db.query("SELECT * FROM diseases ORDER BY name", (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        const out = (results || []).map(r => {
            let subtypes = null;
            if (r.subtypes) {
                try { const p = JSON.parse(r.subtypes); subtypes = Array.isArray(p) ? p : null; } catch (e) { subtypes = null; }
            }
            return { ...r, subtypes };
        });
        res.json(out);
    });
});

// ROUTE: Add a new disease
app.post('/api/diseases', authenticate, (req, res) => {
    const name = (req.body && req.body.name ? req.body.name : '').trim();
    const icon = (req.body && req.body.icon ? String(req.body.icon).slice(0, 100) : null);
    const color = (req.body && req.body.color ? String(req.body.color).slice(0, 20) : null);
    const description = (req.body && req.body.description ? String(req.body.description).slice(0, 255) : null);
    const preventionTips = (req.body && req.body.preventionTips != null && String(req.body.preventionTips).trim() !== '' ? String(req.body.preventionTips) : null);
    const symptoms = (req.body && req.body.symptoms != null && String(req.body.symptoms).trim() !== '' ? String(req.body.symptoms) : null);
    const videoUrl = (req.body && req.body.videoUrl ? String(req.body.videoUrl).slice(0, 255) : null);
    if (!name) return res.status(400).json({ error: 'Disease name is required.' });
    const auto = diseaseClassification(name);
    const notifType = ['immediate', 'weekly'].includes(req.body && req.body.notif_type) ? req.body.notif_type : auto.notif_type;
    const caseType = ['probable', 'confirmed'].includes(req.body && req.body.case_type) ? req.body.case_type : auto.case_type;
    const subtypes = Array.isArray(req.body && req.body.subtypes) ? req.body.subtypes.map(s => String(s).trim()).filter(Boolean).slice(0, 50) : [];
    db.query('INSERT IGNORE INTO diseases (name, icon, color, description, prevention_tips, symptoms, video_url, notif_type, case_type, subtypes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, icon, color, description, preventionTips, symptoms, videoUrl, notifType, caseType, subtypes.length ? JSON.stringify(subtypes) : null], (err, result) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (result.affectedRows === 0) return res.status(409).json({ error: 'Disease already exists.' });
        res.status(201).json({ message: 'Disease added successfully.', id: result.insertId, notif_type: notifType, case_type: caseType });
    });
});

// ROUTE: Update a disease (prevention tips / symptoms / video) - CHO only
app.put('/api/diseases/:id', authenticate, requireRole('CHO'), (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid disease id.' });
    const description = (req.body != null && req.body.description != null && String(req.body.description).trim() !== '' ? String(req.body.description).slice(0, 255) : null);
    const preventionTips = (req.body != null && req.body.preventionTips != null && String(req.body.preventionTips).trim() !== '' ? String(req.body.preventionTips) : null);
    const symptoms = (req.body != null && req.body.symptoms != null && String(req.body.symptoms).trim() !== '' ? String(req.body.symptoms) : null);
    const videoUrl = (req.body != null && req.body.videoUrl ? String(req.body.videoUrl).slice(0, 255) : null);
    const notifType = (req.body != null && ['immediate', 'weekly'].includes(req.body.notif_type)) ? req.body.notif_type : null;
    const caseType = (req.body != null && ['probable', 'confirmed'].includes(req.body.case_type)) ? req.body.case_type : null;
    const subtypes = (req.body != null && Array.isArray(req.body.subtypes)) ? req.body.subtypes.map(s => String(s).trim()).filter(Boolean).slice(0, 50) : null;
    const subtypesJson = subtypes ? JSON.stringify(subtypes) : null;
    const extraClause = (notifType || caseType || subtypesJson) ? ', notif_type = COALESCE(?, notif_type), case_type = COALESCE(?, case_type), subtypes = COALESCE(?, subtypes)' : '';
    const params = [description, preventionTips, symptoms, videoUrl];
    if (notifType || caseType || subtypesJson) params.push(notifType, caseType, subtypesJson);
    params.push(id);
    db.query(
        `UPDATE diseases SET description = ?, prevention_tips = ?, symptoms = ?, video_url = ?${extraClause} WHERE id = ?`,
        params,
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Disease not found.' });
            createAuditLog(
                req.headers['x-user-id'] || null, req.headers['x-user-name'] || 'Unknown', 'CHO', null, null,
                'Updated Prevention Tips', `Disease #${id}`,
                'Updated prevention tips / symptoms / video'
            );
            res.json({ message: 'Disease updated successfully.' });
        }
    );
});

// ROUTE: Hide/unhide a disease (soft delete) - CHO only. Affects Resident portal only.
app.patch('/api/diseases/:id/visibility', authenticate, requireRole('CHO'), (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid disease id.' });
    const active = req.body && req.body.active !== undefined ? (req.body.active ? 1 : 0) : null;
    if (active === null) return res.status(400).json({ error: 'Missing active flag.' });
    db.query('UPDATE diseases SET active = ? WHERE id = ?', [active, id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Disease not found.' });
        createAuditLog(
            req.headers['x-user-id'] || null, req.headers['x-user-name'] || 'Unknown', 'CHO', null, null,
            active ? 'Unhidden Disease' : 'Hidden Disease', `Disease #${id}`,
            active ? 'Disease made visible to Resident portal' : 'Disease hidden from Resident portal'
        );
        res.json({ message: active ? 'Disease is now visible to residents.' : 'Disease hidden from residents.' });
    });
});

// ROUTE: Get all custom disease categories (with their linked disease ids)
app.get('/api/disease_categories', authenticate, (req, res) => {
    db.query('SELECT * FROM disease_categories ORDER BY id', (err, categories) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        db.query('SELECT category_id, disease_id FROM disease_category_items', (err2, items) => {
            if (err2) return res.status(500).json({ error: 'Internal database error. Please try again.' });
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
app.post('/api/disease_categories', authenticate, (req, res) => {
    const name = (req.body && req.body.name ? req.body.name : '').trim();
    const icon = (req.body && req.body.icon ? String(req.body.icon).slice(0, 100) : null);
    const color = (req.body && req.body.color ? String(req.body.color).slice(0, 20) : null);
    const description = (req.body && req.body.description ? String(req.body.description).slice(0, 255) : null);
    const diseaseIds = Array.isArray(req.body && req.body.diseaseIds) ? req.body.diseaseIds.filter(Number.isInteger) : [];
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    db.query('INSERT INTO disease_categories (name, icon, color, description) VALUES (?, ?, ?, ?)', [name, icon, color, description], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category already exists.' });
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        const catId = result.insertId;
        if (diseaseIds.length === 0) return res.status(201).json({ message: 'Category added successfully.', id: catId });
        const values = diseaseIds.map(did => [catId, did]);
        db.query('INSERT IGNORE INTO disease_category_items (category_id, disease_id) VALUES ?', [values], (err2) => {
            if (err2) return res.status(500).json({ error: 'Internal database error. Please try again.' });
            res.status(201).json({ message: 'Category added successfully.', id: catId });
        });
    });
});

// ROUTE: Get list of barangays
app.get('/api/barangays', (req, res) => {
    db.query("SELECT * FROM barangays ORDER BY name", (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        res.json(results);
    });
});

// ROUTE: Get all users (no passwords)
app.get('/api/users', authenticate, (req, res) => {
    const includeArchived = req.query.include_archived === 'true';
    const query = `
        SELECT u.user_id, u.username, u.full_name, u.email, u.mobile_number,
               u.role, u.is_active, u.last_login, u.assigned_barangay_id,
               u.is_archived, u.status,
               b.name AS barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        ${includeArchived ? '' : 'WHERE u.is_archived = 0'}
        ORDER BY u.user_id ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        res.json(results);
    });
});

// ==========================================
// PROFILE ROUTES
// ==========================================

// ROUTE: Get single user profile by ID
app.get('/api/users/:id/profile', authenticate, (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT u.user_id, u.username, u.full_name, u.email, u.mobile_number,
               u.role, u.assigned_barangay_id, u.is_active, u.is_archived,
               u.last_login, u.last_login_location, u.last_login_device,
               u.previous_login, u.previous_login_location, u.previous_login_device,
               u.two_fa_enabled,
               b.name AS assigned_barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        WHERE u.user_id = ?
    `;
    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(results[0]);
    });
});

// ROUTE: Update user profile (name, email, phone, barangay assignment)
app.put('/api/users/:id/profile', authenticate, (req, res) => {
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
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
        console.log(`Profile updated for user ${id}: ${fullName}`);
        res.status(200).json({ message: 'Profile updated successfully.', fullName });
    });
});

// ROUTE: List active login sessions for the authenticated user (Facebook-style)
app.get('/api/users/:id/sessions', authenticate, (req, res) => {
    if (Number(req.params.id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'You can only view your own sessions.' });
    }
    const query = `
        SELECT id, token_id, device, location, created_at
        FROM user_sessions
        WHERE user_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC, id DESC
    `;
    db.query(query, [req.user.user_id], (err, rows) => {
        if (err) {
            console.error('[SESSION] list error:', err.message);
            return res.status(500).json({ error: 'Failed to load sessions.' });
        }
        const currentTokenId = req.user.token_id || null;
        const sessions = (rows || []).map((r) => ({
            id: r.id,
            device: r.device || 'Unknown Device',
            location: r.location || 'Unknown Location',
            created_at: r.created_at,
            isCurrent: !!currentTokenId && r.token_id === currentTokenId,
        }));
        res.json({ sessions, count: sessions.length });
    });
});

// ROUTE: Revoke a single session (cannot revoke your current session)
app.delete('/api/users/:id/sessions/:sessionId', authenticate, (req, res) => {
    if (Number(req.params.id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'You can only manage your own sessions.' });
    }
    const sessionId = Number(req.params.sessionId);
    db.query(
        'SELECT id, token_id, device FROM user_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
        [sessionId, req.user.user_id],
        (err, rows) => {
            if (err) {
                console.error('[SESSION] revoke lookup error:', err.message);
                return res.status(500).json({ error: 'Failed to revoke session.' });
            }
            if (!rows || rows.length === 0) {
                return res.status(404).json({ error: 'Session not found or already revoked.' });
            }
            const session = rows[0];
            if (req.user.token_id && session.token_id === req.user.token_id) {
                return res.status(400).json({ error: 'You cannot revoke your current session.' });
            }
            db.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [sessionId], (uErr) => {
                if (uErr) {
                    console.error('[SESSION] revoke error:', uErr.message);
                    return res.status(500).json({ error: 'Failed to revoke session.' });
                }
                createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay, 'Session Revoked', 'System', `Revoked session on ${session.device || 'Unknown Device'}`);
                res.json({ ok: true });
            });
        }
    );
});

// ROUTE: Revoke all other sessions (keeps the current one active)
app.delete('/api/users/:id/sessions', authenticate, (req, res) => {
    if (Number(req.params.id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'You can only manage your own sessions.' });
    }
    const currentTokenId = req.user.token_id || '';
    db.query(
        "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL AND token_id <> ?",
        [req.user.user_id, currentTokenId],
        (err, result) => {
            if (err) {
                console.error('[SESSION] revoke-all error:', err.message);
                return res.status(500).json({ error: 'Failed to revoke sessions.' });
            }
            const revoked = result ? result.affectedRows : 0;
            createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay, 'All Other Sessions Revoked', 'System', `Revoked ${revoked} other session(s)`);
            res.json({ ok: true, revoked });
        }
    );
});

// ==========================================
// CASE CRUD ROUTES
// ==========================================

// ROUTE: Add new disease case
app.post('/api/cases', authenticate, (req, res) => {
    const {
        patient_name, disease_name, age, severity, gender,
        status, contact, onset_date, address, barangay_id,
        symptoms, physician, latitude, longitude, case_type,
        disease_type, vaccination_status, vaccine_expiry_date,
    } = req.body;

    console.log("--- Add Case ---", { patient_name, disease_name, barangay_id });

    // ── Server-side validation mirror (2.4) ──
    const addValidation = validateCasePayload(req.body);
    if (addValidation.length > 0) {
      return res.status(400).json({ error: addValidation.join(' '), validationErrors: addValidation });
    }

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
                    return res.status(500).json({ error: 'Internal database error. Please try again.' });
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
        if (bErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
        const selectedName = bRes.length > 0 ? bRes[0].name : null;
        routeOrProceed(selectedName);
      });
    } else {
      routeOrProceed(null);
    }
    function proceedAfterCrossCheck() {
      // Contact numbers may be shared between relatives/household members.
      // Duplicate-patient detection (same name + active status) still applies below.
      proceedToCheck();
    }

function proceedToCheck() {
    checkDuplicate(() => {
        withTransaction((t) => {
        const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
        t.q(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
            if (err) { console.error("Find disease error:", err.message); t.rollback(); return res.status(500).json({ error: 'Internal database error. Please try again.' }); }
            let diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;

            const doInsert = (dId) => {
            const reportTs = (req.body && req.body._offlineTimestamp) ? new Date(req.body._offlineTimestamp) : null;
            const autoCls = diseaseClassification(disease_name);
            const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(case_type) ? case_type : autoCls.case_type;
            const resolvedDiseaseType = disease_type != null && String(disease_type).trim() !== '' ? String(disease_type).trim().slice(0, 100) : null;
            const insertQuery = `
                INSERT INTO disease_cases 
                (patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact, 
                 onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported, created_by,
                 vaccination_status, vaccine_expiry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?)
            `;
            const vals = [
                patient_name, dId, age || 0, severity, resolvedCaseType, resolvedDiseaseType, gender || 'Male',
                status || 'Active', contact || null, onset_date || null, address || null,
                barangay_id || null, symptoms || null, physician || null,
                latitude || null, longitude || null, reportTs, req.body.user_id || null,
                vaccination_status || null, vaccine_expiry_date || null
            ];

            t.q(insertQuery, vals, (insertErr, result) => {
                if (insertErr) {
                    console.error("Insert case error:", insertErr.message);
                    t.rollback();
                    return res.status(500).json({ error: 'Internal database error. Please try again.' });
                }
                console.log("Case inserted, ID:", result.insertId);

                // ── Audit log is written INSIDE the transaction ──
                const isOfflineCreate = !!(req.body && req.body._offlineTimestamp);
                const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                const auditAction = isOfflineCreate ? 'Synced Case (Offline)' : 'Created';
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                const finalizeCommit = () => {
                    t.commit(() => {
                        // Trigger auto-notifications after the data writes commit
                        db.query(`
                            SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id, dc.severity
                            FROM disease_cases dc
                            LEFT JOIN diseases d ON dc.disease_id = d.id
                            LEFT JOIN barangays b ON dc.barangay_id = b.id
                            WHERE dc.case_id = ?
                        `, [result.insertId], (nErr, caseResults) => {
                            if (!nErr && caseResults && caseResults.length > 0) {
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

                if (auditUserId) {
                  t.q('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                    if (!uErr && uRes.length > 0) {
                      const u = uRes[0];
                      t.q('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                        const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                        const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                        createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record',
                         `Added new ${auditDisease} case for ${auditPatient} (Case ID: ${result.insertId})`, t);
                        finalizeCommit();
                      });
                    } else {
                      finalizeCommit();
                    }
                  });
                } else {
                  finalizeCommit();
                }
            });
        };

        if (!diseaseId && disease_name) {
            t.q('INSERT IGNORE INTO diseases (name) VALUES (?)', [disease_name], (dErr, dResult) => {
                const newId = dResult && dResult.insertId ? dResult.insertId : null;
                doInsert(newId);
            });
        } else {
            doInsert(diseaseId);
        }
        }); // end find disease query
        }, (txErr) => {
            console.error('Create case transaction failed:', txErr && txErr.message);
            res.status(500).json({ error: 'Add failed. No changes were saved.' });
        });
    });
    }
});

// ROUTE: Route case to inbox (cross-unit) - stores all case data in case_inbox, no disease_cases entry yet
app.post('/api/cases/route-to-inbox', authenticate, (req, res) => {
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
                return res.status(500).json({ error: 'Internal database error. Please try again.' });
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

app.post('/api/cases/route-to-barangay-inbox', authenticate, (req, res) => {
    const {
        patient_name, disease_name, age, severity, gender, status, contact,
        onset_date, address, symptoms, physician, latitude, longitude,
        submitter_user_id, submitter_name, from_cho_unit, target_barangay_name, notes,
        case_type, disease_type, vaccination_status, vaccine_expiry_date,
    } = req.body;

    db.query('SELECT id FROM barangays WHERE LOWER(name) = LOWER(?)', [target_barangay_name], (bErr, bResults) => {
        if (bErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
        if (!bResults || bResults.length === 0) {
            return res.status(400).json({ error: 'Target barangay not found.' });
        }
        const targetBarangayId = bResults[0].id;

        const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
        db.query(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
            const diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;
            const autoCls = diseaseClassification(disease_name);
            const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(case_type) ? case_type : autoCls.case_type;
            const resolvedDiseaseType = disease_type != null && String(disease_type).trim() !== '' ? String(disease_type).trim().slice(0, 100) : null;
            db.query(
                `INSERT INTO disease_cases
                (patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact,
                 onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported,
                 vaccination_status, vaccine_expiry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(), ?, ?)`,
                [patient_name, diseaseId, age || 0, severity, resolvedCaseType, resolvedDiseaseType, gender || 'Male', status || 'Pending',
                 contact || null, onset_date || null, address || null, symptoms || null,
                 physician || null, latitude || null, longitude || null,
                 vaccination_status || null, vaccine_expiry_date || null],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error('route-to-barangay-inbox insert error:', insertErr.message);
                        return res.status(500).json({ error: 'Internal database error. Please try again.' });
                    }
                    const caseId = result.insertId;
                    db.query(
                        'INSERT INTO case_inbox (case_id, from_user_id, from_user_name, from_cho_unit, to_barangay_id, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [caseId, submitter_user_id || null, submitter_name || 'Unknown', from_cho_unit || null, targetBarangayId, 'pending'],
                        (inboxErr, inboxResult) => {
                            if (inboxErr) {
                                console.error('case_inbox insert error:', inboxErr.message);
                                return res.status(500).json({ error: 'Internal database error. Please try again.' });
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
app.get('/api/case-inbox', authenticate, (req, res) => {
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
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        res.json(results);
    });
});

// GET unified outbox - merges referrals + resident messages + edit requests
app.get('/api/case-outbox', authenticate, (req, res) => {
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
      let referrals, residents, editRequests, addRequests;

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

        addRequests = await runQuery(`
          SELECT CONCAT('ar-', car.id) AS id, 'add_request' AS item_type,
            car.patient_name, car.disease_name,
            car.status, b.name AS barangay_name,
            NULL AS to_barangay_name, car.from_barangay_name,
            car.target_cho_unit AS to_cho_unit, NULL AS from_cho_unit,
            'sent' AS direction, car.created_at
          FROM case_add_requests car
          LEFT JOIN barangays b ON car.barangay_id = b.id
          WHERE car.requested_by = ?
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
      const all = [...referrals, ...residents, ...editRequests, ...(addRequests || [])];
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json(all);
    } catch (err) {
      console.error('Unified outbox error:', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  })();
});

// Accept: create disease_cases entry from inbox data, then mark accepted
app.put('/api/case-inbox/:id/accept', authenticate, (req, res) => {
    const { id } = req.params;
    db.query(
        'SELECT * FROM case_inbox WHERE id = ?',
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (rows.length === 0) return res.status(404).json({ error: 'Inbox item not found.' });
            const item = rows[0];

            const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
            db.query(findDiseaseQuery, [item.disease_name], (dErr, dRes) => {
                const diseaseId = dRes && dRes.length > 0 ? dRes[0].id : null;
                withTransaction((t) => {
                    t.q(
                        `INSERT INTO disease_cases
                        (patient_name, disease_id, age, severity, gender, status, contact,
                         onset_date, address, symptoms, physician, latitude, longitude, date_reported,
                         vaccination_status, vaccine_expiry_date)
                        VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, NULL)`,
                        [item.patient_name, diseaseId, item.age || 0, item.severity, item.gender || 'Male',
                         item.contact || null, item.onset_date || null, item.address || null,
                         item.symptoms || null, item.physician || null, item.latitude || null, item.longitude || null],
                        (insertErr, result) => {
                            if (insertErr) { t.rollback(); return console.error('Accept insert error:', insertErr.message); }
                            const caseId = result.insertId;
                            t.q(
                                "UPDATE case_inbox SET case_id = ?, status = 'accepted', resolved_at = NOW() WHERE id = ?",
                                [caseId, id],
                                (updateErr) => {
                                    if (updateErr) { t.rollback(); return console.error('Accept update error:', updateErr.message); }
                                    t.commit(() => {
                                        res.json({ message: 'Case accepted.', case_id: caseId });
                                    });
                                }
                            );
                        }
                    );
                }, (txErr) => {
                    console.error('Inbox accept transaction failed:', txErr && txErr.message);
                    res.status(500).json({ error: 'Accept failed. No changes were saved.' });
                });
            });
        }
    );
});

// Reject: mark inbox item rejected
app.put('/api/case-inbox/:id/reject', authenticate, (req, res) => {
    const { id } = req.params;
    db.query(
        "UPDATE case_inbox SET status = 'rejected', resolved_at = NOW() WHERE id = ?",
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Inbox item not found.' });
            res.json({ message: 'Case rejected.' });
        }
    );
});

// ── CASE EDIT REQUESTS (BHW → CHO) ──

// POST /api/cases/:id/request-edit - BHW requests CHO to edit a case
app.post('/api/cases/:id/request-edit', authenticate, (req, res) => {
  const caseId = req.params.id;
  const { requested_by, requested_by_name, from_barangay_name, target_cho_unit, note, proposed_data } = req.body;
  if (!requested_by || !note) {
    return res.status(400).json({ error: 'requested_by and note are required.' });
  }
  const proposedJson = (proposed_data && Object.keys(proposed_data).length > 0) ? JSON.stringify(proposed_data) : null;
  withTransaction((t) => {
    t.q(
      'INSERT INTO case_edit_requests (case_id, requested_by, requested_by_name, from_barangay_name, target_cho_unit, note, proposed_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [caseId, requested_by, requested_by_name || 'Unknown', from_barangay_name || null, target_cho_unit || null, note, proposedJson],
      (err, result) => {
        if (err) {
          console.error('Edit request insert error:', err.message);
          t.rollback();
          return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }

        // Audit log: BHW submitted an edit request (inside the transaction)
        const finalizeCommit = () => {
          t.commit(() => {
            // Notify CHOs in the target unit (direct BHW→CHO request, bypasses user preferences)
            if (target_cho_unit) {
              const msg = `${requested_by_name || 'A BHW'} from ${from_barangay_name || 'your area'} requested an update for this case. Note: "${note}"`;
              notifyTargetUnitCho(target_cho_unit, 'A BHW needs your help', msg);
            }
            res.json({ message: 'Edit request sent to your CHO.', request_id: result.insertId });
          });
        };
        t.q('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [requested_by], (aErr, aRes) => {
          if (!aErr && aRes.length > 0) {
            const actor = aRes[0];
            createAuditLog(requested_by, actor.full_name, actor.role, null, from_barangay_name || null,
              'Requested Edit', 'Case Record',
              `Submitted edit request for Case ID ${caseId} - Note: "${note.length > 60 ? note.slice(0, 57) + '...' : note}"`, t);
          }
          finalizeCommit();
        });
      }
    );
  }, (txErr) => {
    console.error('Edit request transaction failed:', txErr && txErr.message);
    res.status(500).json({ error: 'Edit request failed. No changes were saved.' });
  });
});

// GET /api/case-edit-requests - Fetch edit requests (CHO: pending by unit, BHW: all by user)
app.get('/api/case-edit-requests', authenticate, (req, res) => {
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
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    res.json(results);
  });
});

// PUT /api/case-edit-requests/:id/accept - CHO accepts edit request
app.put('/api/case-edit-requests/:id/accept', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE case_edit_requests SET status = 'accepted', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found or already resolved.' });
      // Return case_id so frontend can open edit mode
      db.query('SELECT case_id, proposed_data FROM case_edit_requests WHERE id = ?', [id], (sErr, rows) => {
        if (sErr || rows.length === 0) return res.json({ message: 'Request accepted.' });
        let proposed = null;
        try { proposed = rows[0].proposed_data ? JSON.parse(rows[0].proposed_data) : null; } catch (e) { proposed = null; }
        res.json({ message: 'Edit request accepted.', case_id: rows[0].case_id, proposed_data: proposed });
      });
    }
  );
});

// PUT /api/case-edit-requests/:id/reject - CHO rejects edit request
app.put('/api/case-edit-requests/:id/reject', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE case_edit_requests SET status = 'rejected', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found or already resolved.' });
      res.json({ message: 'Edit request rejected.' });
    }
  );
});

// PUT /api/case-edit-requests/:id/read - BHW marks edit request as read
app.put('/api/case-edit-requests/:id/read', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE case_edit_requests SET is_read = 1 WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Edit request not found.' });
      res.json({ message: 'Marked as read.' });
    }
  );
});

// ══════════════════════════════════════════════════════════════
// CASE ADD REQUESTS (BHW → CHO "Submit Case for Approval")
// ══════════════════════════════════════════════════════════════

// POST /api/cases/request-add - BHW submits a new case for CHO approval (no disease_cases insert yet)
app.post('/api/cases/request-add', authenticate, (req, res) => {
  const {
    patient_name, disease_name, age, severity, gender, case_status, contact,
    onset_date, address, barangay_id, symptoms, physician, latitude, longitude,
    requested_by, requested_by_name, from_barangay_name, submitter_cho_unit, note,
    case_type, disease_type, vaccination_status, vaccine_expiry_date,
  } = req.body;

  if (!requested_by || !patient_name || !disease_name) {
    return res.status(400).json({ error: 'requested_by, patient_name and disease_name are required.' });
  }

  // ── Server-side validation mirror (2.4) ──
  const addRequestValidation = validateCasePayload(req.body);
  if (addRequestValidation.length > 0) {
    return res.status(400).json({ error: addRequestValidation.join(' '), validationErrors: addRequestValidation });
  }

  const resolveBarangay = (cb) => {
    if (barangay_id) {
      db.query('SELECT name FROM barangays WHERE id = ?', [barangay_id], (bErr, bRes) => {
        cb((!bErr && bRes.length > 0) ? bRes[0].name : null);
      });
    } else cb(null);
  };

  resolveBarangay((barangayName) => {
    const detectedBarangay = detectBarangayFromAddress(address);
    let targetChoUnit = submitter_cho_unit || null;
    if (detectedBarangay) targetChoUnit = getChoUnitForBarangayName(detectedBarangay) || targetChoUnit;
    if (barangayName) targetChoUnit = getChoUnitForBarangayName(barangayName) || targetChoUnit;

    const autoCls = diseaseClassification(disease_name);
    const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(case_type) ? case_type : autoCls.case_type;
    const resolvedDiseaseType = disease_type != null && String(disease_type).trim() !== '' ? String(disease_type).trim().slice(0, 100) : null;

    let finalLat = latitude || null;
    let finalLng = longitude || null;
    if (barangayName) {
      const clamped = geoSnap.snapToBarangay(longitude, latitude, barangayName, `${barangayName}|${address ? address.replace(/[^0-9a-zA-Z ]/g, ' ') : 'C'}`);
      if (clamped) { finalLat = String(clamped[0]); finalLng = String(clamped[1]); }
    }

    withTransaction((t) => {
      t.q(
        `INSERT INTO case_add_requests
          (patient_name, disease_name, age, severity, case_type, disease_type, gender, case_status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude,
           requested_by, requested_by_name, from_barangay_name, target_cho_unit, note,
           vaccination_status, vaccine_expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_name, disease_name, age || 0, severity, resolvedCaseType, resolvedDiseaseType, gender || 'Male', case_status || 'Active', contact || null, onset_date || null, address || null,
          barangay_id || null, symptoms || null, physician || null, finalLat, finalLng,
          requested_by, requested_by_name || 'Unknown', from_barangay_name || null, targetChoUnit || null, note || null,
          vaccination_status || null, vaccine_expiry_date || null],
        (err, result) => {
          if (err) {
            console.error('Add request insert error:', err.message);
            t.rollback();
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
          }

          // Audit log: BHW submitted an add request (inside the transaction)
          const finalizeCommit = () => {
            t.commit(() => {
              // Notify CHOs in the target unit (direct BHW→CHO request, bypasses preferences)
              if (targetChoUnit) {
                const msg = `${requested_by_name || 'A BHW'} from ${from_barangay_name || 'your area'} submitted a new ${disease_name} case for approval. Note: "${note || '(no note)'}"`;
                notifyTargetUnitCho(targetChoUnit, 'New case awaiting approval', msg);
              }
              res.json({ message: 'Case submitted to your CHO for approval.', request_id: result.insertId });
            });
          };
          t.q('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [requested_by], (aErr, aRes) => {
            if (!aErr && aRes.length > 0) {
              const actor = aRes[0];
              createAuditLog(requested_by, actor.full_name, actor.role, null, from_barangay_name || null,
                'Requested Add', 'Case Record',
                `Submitted new case for approval: ${patient_name} - ${disease_name}`, t);
            }
            finalizeCommit();
          });
        }
      );
    }, (txErr) => {
      console.error('Add request transaction failed:', txErr && txErr.message);
      res.status(500).json({ error: 'Submission failed. No changes were saved.' });
    });
  });
});

// GET /api/case-add-requests - Fetch add requests (CHO: pending by unit, BHW: all by user)
app.get('/api/case-add-requests', authenticate, (req, res) => {
  const { cho_unit, requested_by, unread_only } = req.query;
  let sql = `SELECT car.*, b.name AS barangay_name
    FROM case_add_requests car
    LEFT JOIN barangays b ON car.barangay_id = b.id
    WHERE 1=1`;
  const params = [];
  if (cho_unit) {
    sql += ' AND car.target_cho_unit = ? AND car.status = ?';
    params.push(cho_unit, 'pending');
  }
  if (requested_by) {
    sql += ' AND car.requested_by = ?';
    params.push(requested_by);
  }
  if (unread_only === 'true') {
    sql += ' AND car.is_read = 0';
  }
  sql += ' ORDER BY car.created_at DESC';
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('case-add-requests query error:', err.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    res.json(results);
  });
});

// PUT /api/case-add-requests/:id/approve - CHO approves (may edit details first) → inserts into disease_cases
app.put('/api/case-add-requests/:id/approve', authenticate, (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const {
    patient_name, disease_name, age, severity, gender, case_status, contact,
    onset_date, address, barangay_id, symptoms, physician, latitude, longitude,
    case_type, disease_type, vaccination_status, vaccine_expiry_date,
  } = body;

  db.query('SELECT * FROM case_add_requests WHERE id = ? AND status = ?', [id, 'pending'], (qErr, rows) => {
    if (qErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
    if (rows.length === 0) return res.status(404).json({ error: 'Add request not found or already resolved.' });
    const reqRow = rows[0];
    const final = {
      patient_name: patient_name || reqRow.patient_name,
      disease_name: disease_name || reqRow.disease_name,
      age: (age !== undefined && age !== null && age !== '') ? age : reqRow.age,
      severity: severity || reqRow.severity || 'Moderate',
      gender: gender || reqRow.gender || 'Male',
      case_status: case_status || reqRow.case_status || 'Active',
      contact: contact || reqRow.contact,
      onset_date: onset_date || reqRow.onset_date,
      address: address || reqRow.address,
      barangay_id: barangay_id ? Number(barangay_id) : (reqRow.barangay_id || null),
      symptoms: symptoms || reqRow.symptoms,
      physician: physician || reqRow.physician,
      latitude: latitude || reqRow.latitude,
      longitude: longitude || reqRow.longitude,
      case_type: ['Suspected', 'Probable', 'Confirmed'].includes(case_type) ? case_type : (reqRow.case_type || diseaseClassification(reqRow.disease_name).case_type),
      disease_type: (disease_type !== undefined && disease_type !== null && String(disease_type).trim() !== '') ? String(disease_type).trim().slice(0, 100) : reqRow.disease_type,
      vaccination_status: vaccination_status || reqRow.vaccination_status || null,
      vaccine_expiry_date: vaccine_expiry_date || reqRow.vaccine_expiry_date || null,
    };

    // ── Server-side validation mirror (2.4) ──
    const approveValidation = validateCasePayload(final);
    if (approveValidation.length > 0) {
      return res.status(400).json({ error: approveValidation.join(' '), validationErrors: approveValidation });
    }

    const checkDuplicate = (cb) => {
      if (!final.patient_name || final.case_status === 'Draft') return cb();
      db.query(
        'SELECT case_id, status FROM disease_cases WHERE patient_name LIKE ? AND status IN (?, ?, ?) LIMIT 1',
        [final.patient_name, 'Active', 'Under Treatment', 'Pending'],
        (dupErr, dupRes) => {
          if (dupErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
          if (dupRes && dupRes.length > 0) {
            return res.status(409).json({
              error: `Patient "${final.patient_name}" already has an active case (Status: ${dupRes[0].status}). Please resolve the existing case before adding a new one.`
            });
          }
          cb();
        }
      );
    };

    checkDuplicate(() => {
      const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
      db.query(findDiseaseQuery, [final.disease_name], (dErr, dRes) => {
        const dId = (dRes && dRes.length > 0) ? dRes[0].id : null;
        const doInsert = (finalId) => {
          const insertWithCoords = (lat, lng) => {
            withTransaction((t) => {
              t.q(
                `INSERT INTO disease_cases
                    (patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude, created_by, vaccination_status, vaccine_expiry_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [final.patient_name, finalId, final.age || 0, final.severity, final.case_type, final.disease_type || null, final.gender, final.case_status,
                  final.contact || null, final.onset_date || null, final.address || null, final.barangay_id,
                  final.symptoms || null, final.physician || null, lat, lng, reqRow.requested_by || null,
                  final.vaccination_status, final.vaccine_expiry_date],
              (insErr, insResult) => {
                if (insErr) { t.rollback(); return console.error('Approve insert case error:', insErr.message); }
                const newCaseId = insResult.insertId;
                const resolverId = body.actor_id || null;
                t.q(
                  'INSERT INTO case_status_history (case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [newCaseId, reqRow.case_status || 'Pending', final.case_status, resolverId, body.actor_name || 'CHO', body.actor_role || 'CHO', 'Add request approved by CHO'],
                  (hErr) => {
                    if (hErr) { t.rollback(); return console.error('Approve status history error:', hErr.message); }
                    t.q(
                      "UPDATE case_add_requests SET status = 'accepted', resolved_at = NOW(), resolved_by = ?, case_id = ? WHERE id = ? AND status = 'pending'",
                      [resolverId, newCaseId, id],
                      (uErr) => {
                        if (uErr) { t.rollback(); return console.error('Approve request status error:', uErr.message); }
                        t.commit(() => {
                          // -- Side effects after the database writes commit --
                          db.query('SELECT user_id, full_name, email FROM users WHERE user_id = ?', [reqRow.requested_by], (bErr, bRes) => {
                            if (!bErr && bRes.length > 0) {
                              const bhw = bRes[0];
                              if (bhw.email) {
                                const html = `
                                  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f0fdf4;border-radius:12px">
                                    <h2 style="color:#16a34a;margin:0 0 8px 0">Case Approved</h2>
                                    <p style="color:#334155;font-size:14px">Hello ${bhw.full_name},</p>
                                    <p style="color:#334155;font-size:14px">Your submitted case for <strong>${final.patient_name}</strong> (<strong>${final.disease_name}</strong>) was approved and is now on record.</p>
                                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                                    <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
                                  </div>`;
                                sendBrevoEmail(bhw.email, 'Case Approved - Cabuyao CDMS', html)
                                  .catch(err => console.error('Add-approval email failed:', err.message));
                              }
                              db.query('INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                                [bhw.user_id, 'Case approved', `Your case for ${final.patient_name} (${final.disease_name}) was approved by the CHO. (Case ID: ${newCaseId})`, 'success', 'ManageCases']);
                            }
                          });
                          createAuditLog(resolverId || null, body.actor_name || 'CHO', body.actor_role || 'CHO', null, reqRow.from_barangay_name || null,
                            'Approved Add', 'Case Record', `Approved new case for ${final.patient_name} - ${final.disease_name} (from ${reqRow.requested_by_name || 'BHW'})`);
                          res.json({ message: 'Case approved and added to records.', case_id: newCaseId });
                        });
                      }
                    );
                  }
                );
              }
            );
          }, (txErr) => {
            console.error('Approve add transaction failed:', txErr && txErr.message);
            res.status(500).json({ error: 'Approval failed. No changes were saved.' });
          });
        };
        db.query('SELECT name FROM barangays WHERE id = ?', [final.barangay_id], (snapErr, snapRows) => {
          const bName = (!snapErr && snapRows.length > 0) ? snapRows[0].name : null;
          let lat = final.latitude || null;
          let lng = final.longitude || null;
          if (bName) {
            const clamped = geoSnap.snapToBarangay(final.longitude, final.latitude, bName, `${bName}|${final.address ? final.address.replace(/[^0-9a-zA-Z ]/g, ' ') : 'C'}`);
            if (clamped) { lat = String(clamped[0]); lng = String(clamped[1]); }
          }
          insertWithCoords(lat, lng);
        });
      };
        if (!dId && final.disease_name) {
          db.query('INSERT IGNORE INTO diseases (name) VALUES (?)', [final.disease_name], (iErr, iRes) => {
            doInsert(iRes && iRes.insertId ? iRes.insertId : null);
          });
        } else doInsert(dId);
      });
    });
  });
});

// PUT /api/case-add-requests/:id/reject - CHO rejects (with optional reason)
app.put('/api/case-add-requests/:id/reject', authenticate, (req, res) => {
  const { id } = req.params;
  const { reason, actor_id, actor_name, actor_role } = req.body || {};
  withTransaction((t) => {
    t.q(
      "UPDATE case_add_requests SET status = 'rejected', resolved_at = NOW(), resolved_by = ?, reject_reason = ? WHERE id = ? AND status = 'pending'",
      [actor_id || null, reason || null, id],
      (err, result) => {
        if (err) {
          console.error('Reject add update error:', err.message);
          t.rollback();
          return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (result.affectedRows === 0) {
          t.rollback();
          return res.status(404).json({ error: 'Add request not found or already resolved.' });
        }
        t.q('SELECT * FROM case_add_requests WHERE id = ?', [id], (sErr, rows) => {
          if (sErr || rows.length === 0) {
            t.rollback();
            return res.json({ message: 'Add request rejected.' });
          }
          const reqRow = rows[0];
          // Audit log is written inside the transaction
          const finalizeCommit = () => {
            t.commit(() => {
              db.query('SELECT user_id, full_name, email FROM users WHERE user_id = ?', [reqRow.requested_by], (bErr, bRes) => {
                if (!bErr && bRes.length > 0) {
                  const bhw = bRes[0];
                  if (bhw.email) {
                    const reasonHtml = reason ? `<p style="color:#334155;font-size:14px"><strong>Reason:</strong> ${reason}</p>` : '';
                    const html = `
                      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fef2f2;border-radius:12px">
                        <h2 style="color:#dc2626;margin:0 0 8px 0">Case Not Approved</h2>
                        <p style="color:#334155;font-size:14px">Hello ${bhw.full_name},</p>
                        <p style="color:#334155;font-size:14px">Your submitted case for <strong>${reqRow.patient_name}</strong> (<strong>${reqRow.disease_name}</strong>) was not approved.</p>
                        ${reasonHtml}
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                        <p style="color:#94a3b8;font-size:11px">Cabuyao City Disease Monitoring System</p>
                      </div>`;
                    sendBrevoEmail(bhw.email, 'Case Not Approved - Cabuyao CDMS', html)
                      .catch(err => console.error('Add-rejection email failed:', err.message));
                  }
                  db.query('INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                    [bhw.user_id, 'Case not approved', `Your case for ${reqRow.patient_name} (${reqRow.disease_name}) was not approved${reason ? `: ${reason}` : '.'}`, 'info', 'ManageCases']);
                }
              });
              res.json({ message: 'Add request rejected.' });
            });
          };
          createAuditLog(actor_id || null, actor_name || 'CHO', actor_role || 'CHO', null, reqRow.from_barangay_name || null,
            'Rejected Add', 'Case Record', `Rejected new case for ${reqRow.patient_name} - ${reqRow.disease_name}${reason ? ` (Reason: ${reason})` : ''}`, t);
          finalizeCommit();
        });
      }
    );
  }, (txErr) => {
    console.error('Reject add transaction failed:', txErr && txErr.message);
    res.status(500).json({ error: 'Rejection failed. No changes were saved.' });
  });
});

// PUT /api/case-add-requests/:id/read - BHW marks add request as read
app.put('/api/case-add-requests/:id/read', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE case_add_requests SET is_read = 1 WHERE id = ?',
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Add request not found.' });
      res.json({ message: 'Marked as read.' });
    }
  );
});

// ══════════════════════════════════════════════════════════════
// PASSWORD CHANGE REQUESTS (BHW → CHO)
// ══════════════════════════════════════════════════════════════

// POST /api/password-change-request - BHW requests password change
app.post('/api/password-change-request', authenticate, (req, res) => {
  const { user_id, user_name, reason } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required.' });

  // Check for existing pending request
  db.query(
    "SELECT id FROM password_change_requests WHERE user_id = ? AND status = 'pending'",
    [user_id],
    (checkErr, existing) => {
      if (checkErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'You already have a pending password change request.' });
      }

      db.query(
        'INSERT INTO password_change_requests (user_id, user_name) VALUES (?, ?)',
        [user_id, user_name || 'Unknown'],
        (err, result) => {
          if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });

          // Notify all active CHO users (bypass preferences - same as case edit requests)
          db.query(
            `SELECT user_id FROM users WHERE role = 'CHO' AND is_active = 1`,
            [],
            (nErr, users) => {
              if (!nErr && users && users.length > 0) {
                const msg = reason === 'first_login_temp'
                  ? `${user_name || 'A BHW'} is a new user who logged in with a generated temporary password and would like to change it immediately. Please review and approve or reject this request.`
                  : `${user_name || 'A BHW'} is requesting a password change. Please review and approve or reject this request.`;
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

// GET /api/password-change-requests - Fetch password change requests
app.get('/api/password-change-requests', authenticate, (req, res) => {
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
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json(results);
  });
});

// PUT /api/password-change-requests/:id/accept - CHO accepts
app.put('/api/password-change-requests/:id/accept', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE password_change_requests SET status = 'accepted', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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

// PUT /api/password-change-requests/:id/reject - CHO rejects
app.put('/api/password-change-requests/:id/reject', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE password_change_requests SET status = 'rejected', resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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

// PUT /api/password-change-requests/:id/read - BHW marks as read
app.put('/api/password-change-requests/:id/read', authenticate, (req, res) => {
  const { id } = req.params;
  db.query('UPDATE password_change_requests SET is_read = 1 WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Request not found.' });
    res.json({ message: 'Marked as read.' });
  });
});

// PUT /api/users/:id/set-password - BHW sets new password after approval (no current password check)
app.put('/api/users/:id/set-password', authenticate, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  db.query('SELECT full_name, role FROM users WHERE user_id = ?', [id], (fErr, fRows) => {
    if (fErr) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    const who = (fRows && fRows[0]) || {};
    const [sFirst, ...sRest] = (who.full_name || '').split(' ');
    const denied = [sFirst || '', sRest.join(' ') || '', (who.role || 'BHW') === 'CHO' ? 'CHO' : 'BHW'];
    const pwErrors = validatePasswordStrength(newPassword, denied);
    if (pwErrors.length > 0) {
      return res.status(400).json({ error: pwErrors.join(' ') });
    }

    // Gate: verify an accepted request exists before allowing password change
    db.query('SELECT id FROM password_change_requests WHERE user_id = ? AND status = \'accepted\' LIMIT 1', [id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      if (!rows || rows.length === 0) {
        return res.status(403).json({ error: 'No approved password change request found. Please wait for CHO approval.' });
      }

      const hashed = bcrypt.hashSync(newPassword, 10);
      db.query('UPDATE users SET password = ?, must_change_password = 0, initial_password = NULL WHERE user_id = ?', [hashed, id], (err2, result) => {
        if (err2) return res.status(500).json({ error: 'Internal database error. Please try again.' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });

        // Mark the accepted request as fully resolved
        db.query("UPDATE password_change_requests SET status = 'resolved', resolved_at = NOW() WHERE user_id = ? AND status = 'accepted'", [id]);

        res.json({ message: 'Password updated successfully.' });
      });
    });
  });
});

// ROUTE: Update existing case
app.put('/api/cases/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const {
        patient_name, disease_name, age, severity, gender,
        status, contact, onset_date, address, barangay_id,
        symptoms, physician, latitude, longitude, case_type,
        disease_type, vaccination_status, vaccine_expiry_date,
    } = req.body;

    console.log("--- Update Case ---", { id, patient_name });

    // ── Server-side validation mirror (2.4) ──
    const updateValidation = validateCasePayload(req.body);
    if (updateValidation.length > 0) {
      return res.status(400).json({ error: updateValidation.join(' '), validationErrors: updateValidation });
    }

    const findDiseaseQuery = 'SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)';
    
    db.query(findDiseaseQuery, [disease_name], (err, diseaseResults) => {
        let diseaseId = diseaseResults && diseaseResults.length > 0 ? diseaseResults[0].id : null;

        const doUpdate = (dId) => {
            const offlineTs = (req.body && req.body._offlineTimestamp) ? new Date(req.body._offlineTimestamp).getTime() : 0;

            // Fetch full existing record before updating (for status transition + field-level audit logging)
            db.query('SELECT dc.*, d.name AS _oldDiseaseName FROM disease_cases dc LEFT JOIN diseases d ON dc.disease_id = d.id WHERE dc.case_id = ?', [id], (oldErr, oldRows) => {
              const oldRow = (!oldErr && oldRows && oldRows.length > 0) ? oldRows[0] : null;
              const oldStatus = oldRow ? oldRow.status : null;

            const applyUpdate = () => {
            const updateQuery = `
                UPDATE disease_cases SET
                    patient_name = ?, disease_id = ?, age = ?, severity = ?, case_type = ?, disease_type = ?, gender = ?,
                    status = ?, contact = ?, onset_date = ?, address = ?,
                    barangay_id = ?, symptoms = ?, physician = ?,
                    latitude = ?, longitude = ?, vaccination_status = ?, vaccine_expiry_date = ?
                WHERE case_id = ?
            `;
            const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(case_type)
                ? case_type
                : ((oldRow && oldRow.case_type) || diseaseClassification(disease_name).case_type);
            const resolvedDiseaseType = disease_type != null && String(disease_type).trim() !== '' ? String(disease_type).trim().slice(0, 100) : null;
            const vals = [
                patient_name, dId, age || 0, severity, resolvedCaseType, resolvedDiseaseType, gender || 'Male',
                status, contact || null, onset_date || null, address || null,
                barangay_id || null, symptoms || null, physician || null,
                latitude || null, longitude || null,
                vaccination_status || null, vaccine_expiry_date || null, id
            ];

            withTransaction((t) => {
            t.q(updateQuery, vals, (updateErr, result) => {
                if (updateErr) {
                    console.error("Update case error:", updateErr.message);
                    t.rollback();
                    return res.status(500).json({ error: 'Internal database error. Please try again.' });
                }
                if (result.affectedRows === 0) {
                    t.rollback();
                    return res.status(404).json({ error: 'Case not found.' });
                }
                console.log("Case updated:", id);

                // ── Audit log + status history are written INSIDE the transaction ──
                const isOfflineEdit = !!(req.body && req.body._offlineTimestamp);
                const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                const auditAction = isOfflineEdit ? 'Synced Edit (Offline)' : 'Updated';
                const auditDisease = disease_name || 'Unknown Disease';
                const auditPatient = patient_name || 'Unknown Patient';
                const auditDetails = `Updated ${auditDisease} case for ${auditPatient}`;

                const finalizeCommit = () => {
                    t.commit(() => {
                        // Trigger status updated notification (after commit)
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
                                              'INSERT INTO notifications (user_id, title, message, type, link_to, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
                                              [er.requested_by, erTitle, erMsg, 'info', 'ManageCases', id]
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

                const afterStatusHistory = () => {
                    if (auditUserId) {
                      t.q('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                        if (!uErr && uRes.length > 0) {
                          const u = uRes[0];
                          t.q('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                            const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                            const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                            createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record', auditDetails, t);
                            finalizeCommit();
                          });
                        } else {
                          finalizeCommit();
                        }
                      });
                    } else {
                      finalizeCommit();
                    }
                };

                // Record status transition if status changed
                if (oldStatus && oldStatus !== status) {
                  const historyUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
                  const historyUserName = (req.body && (req.body.user_name || req.body._offlineUserName)) || null;
                  t.q(
                    'INSERT INTO case_status_history (case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role) VALUES (?, ?, ?, ?, ?, ?)',
                    [id, oldStatus, status, historyUserId, historyUserName, req.body?.user_role || null],
                    (hErr) => { if (hErr) console.error('Status history error:', hErr.message); afterStatusHistory(); }
                  );
                } else {
                  afterStatusHistory();
                }
            });
            }, (txErr) => {
                console.error('Update case transaction failed:', txErr && txErr.message);
                res.status(500).json({ error: 'Update failed. No changes were saved.' });
            });
            };
            if (offlineTs) {
                db.query('SELECT updated_at FROM disease_cases WHERE case_id = ?', [id], (cErr, cRows) => {
                    if (cErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
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

        // Contact numbers may be shared between relatives/household members.
        proceedToUpdate();

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
app.get('/api/cases/:id/status-history', authenticate, (req, res) => {
  const { id } = req.params;
  db.query(
    `SELECT id, case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role, changed_at, notes
     FROM case_status_history WHERE case_id = ? ORDER BY changed_at ASC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      res.json(rows);
    }
  );
});

// ROUTE: Admin-edit a user account
app.put('/api/users/:id', authenticate, requireRole('CHO'), async (req, res) => {
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
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log("User updated:", id);
        // If newPassword provided, update it, email the user, and send in-app notification
        const afterUpdate = () => {
          if (newPassword && newPassword.trim()) {
            const [pFirst, ...pRest] = (fullName || '').split(' ');
            const denied = [pFirst || '', pRest.join(' ') || '', (role || 'BHW') === 'CHO' ? 'CHO' : 'BHW'];
            const pwChk = validatePasswordStrength(newPassword.trim(), denied);
            if (pwChk.length > 0) {
              return res.status(400).json({ error: pwChk.join(' ') });
            }
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
app.put('/api/users/:id/change-password', authenticate, (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    db.query('SELECT password, full_name, role FROM users WHERE user_id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found.' });

        const [cFirst, ...cRest] = (results[0].full_name || '').split(' ');
        const denied = [cFirst || '', cRest.join(' ') || '', (results[0].role || 'BHW') === 'CHO' ? 'CHO' : 'BHW'];
        const pwErrors = validatePasswordStrength(newPassword, denied);
        if (pwErrors.length > 0) {
          return res.status(400).json({ error: pwErrors.join(' ') });
        }

        const pwValid = bcrypt.compareSync(currentPassword, results[0].password) || results[0].password === currentPassword;
        if (!pwValid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        // Prevent reusing the current password
        if (bcrypt.compareSync(newPassword, results[0].password)) {
            return res.status(400).json({ error: 'New password must be different from your current password.' });
        }

        const hashedNew = bcrypt.hashSync(newPassword, 10);
        db.query('UPDATE users SET password = ?, must_change_password = 0, initial_password = NULL, two_fa_token = NULL, two_fa_token_expiry = NULL WHERE user_id = ?', [hashedNew, id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
            return res.status(200).json({ message: 'Password updated successfully.' });
        });
    });
});




// ROUTE: Delete disease case
app.delete('/api/cases/:id', authenticate, requireRole('CHO'), (req, res) => {
    const { id } = req.params;
    console.log("--- Archive Case ---", { id });

    const fetchCaseQuery = `
        SELECT dc.*, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id
        FROM disease_cases dc
        LEFT JOIN diseases d ON dc.disease_id = d.id
        LEFT JOIN barangays b ON dc.barangay_id = b.id
        WHERE dc.case_id = ?
    `;
    
    db.query(fetchCaseQuery, [id], (err, caseResults) => {
        if (err) {
            console.error("Fetch case error before archive:", err.message);
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        
        if (!caseResults || caseResults.length === 0) {
            return res.status(404).json({ error: 'Case not found.' });
        }
        
        const caseInfo = caseResults[0];
        const { patient_name, disease_name, barangay_name, barangay_id } = caseInfo;

        // Soft archive instead of permanent delete - the record stays in the DB
        // so the patient can be found again if they resurface in the future.
        const archiveQuery = 'UPDATE disease_cases SET is_archived = 1 WHERE case_id = ?';
        
withTransaction((t) => {
    t.q(archiveQuery, [id], (delErr, delResult) => {
            if (delErr) {
                console.error("Archive case error:", delErr.message);
                t.rollback();
                return res.status(500).json({ error: 'Internal database error. Please try again.' });
            }
            if ((!delResult || delResult.affectedRows === 0) && (delResult && delResult.changedRows === 0)) {
                t.rollback();
                return res.status(404).json({ error: 'Case not found.' });
            }

            // Phase 1b: snapshot the full case into the retention archive (inside the same transaction)
            archiveRecord('case', id, `${disease_name || 'Case'} - ${patient_name || 'Unknown'}`, caseInfo, {
                id: (req.body && (req.body.user_id || req.body._offlineUserId)) || (req.user && req.user.user_id) || null,
                name: (req.body && req.body.user_name) || (req.user && req.user.name) || 'CHO',
                role: (req.user && req.user.role) || null,
            }, (req.body && req.body._offlineTimestamp) ? 'Synced Archive (Offline)' : 'Archived', t);

            // Write audit log entry (inside the same transaction)
            const isOfflineDelete = !!(req.body && req.body._offlineTimestamp);
            const auditUserId = (req.body && (req.body.user_id || req.body._offlineUserId)) || null;
            const auditAction = isOfflineDelete ? 'Synced Archive (Offline)' : 'Archived';
            const auditDisease = disease_name || 'Unknown Disease';
            const auditPatient = patient_name || 'Unknown Patient';
            if (auditUserId) {
              t.q('SELECT full_name, role, assigned_barangay_id FROM users WHERE user_id = ?', [auditUserId], (uErr, uRes) => {
                if (!uErr && uRes.length > 0) {
                  const u = uRes[0];
                  t.q('SELECT name FROM barangays WHERE id = ?', [u.assigned_barangay_id], (bErr, bRes) => {
                    const brgy = (!bErr && bRes.length > 0) ? bRes[0].name : null;
                    const choUnit = u.role === 'CHO' ? getChoUnitForBarangay(brgy) : null;
                    createAuditLog(auditUserId, u.full_name, u.role, choUnit, brgy, auditAction, 'Case Record',
                     `Archived case for ${auditPatient} (${auditDisease}) in Barangay ${barangay_name || 'N/A'} (Case ID: ${id})`, t);
                    t.commit(() => {
                        const title = 'Case Archived';
                        const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been archived.`;
                        createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id, 'delete');
                        console.log(`Case ${id} archived (soft delete).`);
                        return res.status(200).json({ message: 'Case archived successfully.' });
                    });
                  });
                } else {
                  t.commit(() => {
                        const title = 'Case Archived';
                        const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been archived.`;
                        createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id, 'delete');
                        console.log(`Case ${id} archived (soft delete).`);
                        return res.status(200).json({ message: 'Case archived successfully.' });
                    });
                }
              });
            } else {
              t.commit(() => {
                        const title = 'Case Archived';
                        const message = `Case for ${patient_name} (${disease_name}) in Barangay ${barangay_name || 'N/A'} has been archived.`;
                        createNotificationForUsers(title, message, 'delete', 'ManageCases', barangay_id, 'delete');
                        console.log(`Case ${id} archived (soft delete).`);
                        return res.status(200).json({ message: 'Case archived successfully.' });
                    });
            }
        });
}, (txErr) => {
        console.error("Archive case transaction error:", txErr.message);
        logAppError('error', 'archive-case', txErr.message, txErr.stack);
        return res.status(500).json({ error: 'Internal database error. Please try again.' });
    });
});
});

// ROUTE: Restore an archived case
app.post('/api/cases/:id/restore', authenticate, requireRole('CHO'), (req, res) => {
    const { id } = req.params;
    console.log("--- Restore Case ---", { id });

    db.query(
        'SELECT patient_name, is_archived, barangay_id FROM disease_cases WHERE case_id = ?',
        [id],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Internal database error. Please try again.' });
            if (!results || results.length === 0) return res.status(404).json({ error: 'Case not found.' });
            if (results[0].is_archived !== 1) return res.status(400).json({ error: 'Case is not archived.' });

            db.query('UPDATE disease_cases SET is_archived = 0 WHERE case_id = ?', [id], (uErr, uResult) => {
                if (uErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
                const rid = req.user ? req.user.user_id : (req.body.user_id || null);
                const rname = req.user ? req.user.name : (req.body.user_name || 'CHO');
                const brgy = req.user ? req.user.barangay : (req.body.barangay || null);
                createAuditLog(rid, rname, req.user ? req.user.role : 'CHO', null, brgy, 'Restored', 'Case Record',
                    `Restored archived case #${id} for ${results[0].patient_name}`);
                return res.status(200).json({ message: 'Case restored successfully.' });
            });
        }
    );
});

// ROUTE: Delete a user account
app.delete('/api/users/:id', authenticate, requireRole('CHO'), (req, res) => {
    const { id } = req.params;
    const callerId = req.user ? req.user.user_id : null;
    if (callerId && Number(id) === Number(callerId)) {
        return res.status(400).json({ error: 'You cannot archive your own account.' });
    }
    // Soft archive instead of permanent delete - the account stays in the DB
    db.query('SELECT * FROM users WHERE user_id = ?', [id], (selErr, selRows) => {
      const userSnapshot = (!selErr && selRows && selRows.length > 0) ? selRows[0] : null;
    db.query('UPDATE users SET is_archived = 1 WHERE user_id = ?', [id], (err, result) => {
        if (err) {
            console.error("Archive user error:", err.message);
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        // Phase 1b: snapshot the account into the retention archive
        if (userSnapshot) {
          archiveRecord('user', id, userSnapshot.full_name || `User ID ${id}`, userSnapshot, { id: callerId }, 'Archived');
        }
        const writeAudit = (admin) => {
            const adminName = admin ? admin.full_name : 'CHO Admin';
            const adminRole = admin ? admin.role : 'CHO';
            const choUnit = admin ? (admin.role === 'CHO' ? 'CHO Unit I' : null) : null;
            const barangay = admin ? admin.barangay : null;
            const fullName = admin ? admin.archivedName : `User ID ${id}`;
            createAuditLog(callerId, adminName, adminRole, choUnit, barangay, 'Archived', 'User Account', `Archived account for ${fullName} (User ID: ${id})`);
        };
        db.query(
            'SELECT u.full_name AS archivedName, a.full_name, a.role, b.name AS barangay FROM users u LEFT JOIN users a ON a.user_id = ? LEFT JOIN barangays b ON a.assigned_barangay_id = b.id WHERE u.user_id = ?',
            [callerId, id], (aErr, aRes) => {
                writeAudit((aRes && aRes[0]) ? aRes[0] : null);
            });
        console.log(`User ${id} archived.`);
        res.status(200).json({ message: 'User account archived successfully.' });
    });
    });
});

// ROUTE: Restore an archived user account
app.put('/api/users/:id/restore', authenticate, requireRole('CHO'), (req, res) => {
    const { id } = req.params;
    db.query('UPDATE users SET is_archived = 0 WHERE user_id = ?', [id], (err, result) => {
        if (err) {
            console.error("Restore user error:", err.message);
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        createAuditLog(id, 'CHO Admin', 'CHO', null, null, 'Restored', 'User Account', `Restored user account ID ${id}`);
        res.status(200).json({ message: 'User account restored successfully.' });
    });
});


// ==========================================
// AUDIT LOG ROUTES
// ==========================================

// GET all audit logs (newest first)
app.get('/api/audit-logs', authenticate, (req, res) => {
  const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000) : null;
  const offset = req.query.offset ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;
  const pagination = limit ? ` LIMIT ${limit} OFFSET ${offset}` : '';
  db.query(`SELECT * FROM audit_logs ORDER BY created_at DESC${pagination}`, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (!limit) return res.json(results);
    db.query('SELECT COUNT(*) AS total FROM audit_logs', (cErr, cnt) => {
      if (cErr) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      res.json({ rows: results, total: cnt && cnt[0] ? cnt[0].total : results.length, limit, offset });
    });
  });
});

// POST a manual audit log entry (for frontend-triggered events)
app.post('/api/audit-logs', authenticate, (req, res) => {
  const { user_id, user_name, user_role, cho_unit, barangay, action, entity, details } = req.body;
  db.query(
    'INSERT INTO audit_logs (user_id, user_name, user_role, cho_unit, barangay, action, entity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id || null, user_name || 'System', user_role || 'System', cho_unit || null, barangay || null, action, entity, details],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      res.status(201).json({ message: 'Audit log created', id: result.insertId });
    }
  );
});

// ==========================================
// GENERATED REPORTS ROUTES
// ==========================================

// GET all generated reports (newest first), optionally filtered by cho_unit
app.get('/api/generated-reports', authenticate, (req, res) => {
  const { cho_unit } = req.query;
  let sql = 'SELECT * FROM generated_reports';
  const params = [];

  if (cho_unit) {
    sql += ' WHERE cho_unit = ?';
    params.push(cho_unit);
  }

  sql += ' ORDER BY created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
app.post('/api/generated-reports', authenticate, (req, res) => {
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
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    res.status(201).json({ message: 'Report generated successfully', id: result.insertId });
  });
});

// DELETE a generated report
app.delete('/api/generated-reports/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM generated_reports WHERE id = ?', [id], (selErr, selRows) => {
    const rep = (!selErr && selRows && selRows.length > 0) ? selRows[0] : null;
  db.query('DELETE FROM generated_reports WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    // Phase 1b: snapshot the deleted report into the retention archive
    if (rep) archiveRecord('generated_report', id, rep.title || `Report #${id}`, rep, {
      id: req.user ? req.user.user_id : null,
      name: req.user ? req.user.name : 'CHO',
      role: req.user ? req.user.role : null,
    }, 'Deleted');
    res.json({ message: 'Report deleted successfully' });
  });
  });
});

// ═════════════════════════════════════════════════════════════
// ARCHIVE VAULT ROUTES (Phase 1b) - CHO-only retention archive
// ═════════════════════════════════════════════════════════════

// GET archive records - optional filters: entity, search, limit/offset
app.get('/api/archive-records', authenticate, requireRole('CHO'), (req, res) => {
  const entity = req.query.entity || '';
  const search = req.query.search || '';
  const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500) : 50;
  const offset = req.query.offset ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;
  let sql = 'SELECT * FROM archive_records WHERE 1=1';
  const params = [];
  if (entity) { sql += ' AND entity = ?'; params.push(entity); }
  if (search) { sql += ' AND (snapshot_name LIKE ? OR entity_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY archived_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    const parsed = results.map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}) }));
    db.query('SELECT COUNT(*) AS total FROM archive_records', (cErr, cnt) => {
      res.json({ records: parsed, total: cErr ? 0 : cnt[0].total });
    });
  });
});

// GET archive record totals per entity (for the Vault summary chips)
app.get('/api/archive-records/totals', authenticate, requireRole('CHO'), (req, res) => {
  db.query('SELECT entity, COUNT(*) AS count FROM archive_records GROUP BY entity', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    const totals = { case: 0, user: 0, generated_report: 0, contact_message: 0 };
    (rows || []).forEach(r => { if (r.entity in totals) totals[r.entity] = r.count; });
    res.json(totals);
  });
});

// GET archive records as JSON for export (CHO-only)
app.get('/api/archive-records/export', authenticate, requireRole('CHO'), (req, res) => {
  const entity = req.query.entity || '';
  let sql = 'SELECT * FROM archive_records WHERE 1=1';
  const params = [];
  if (entity) { sql += ' AND entity = ?'; params.push(entity); }
  sql += ' ORDER BY archived_at DESC';
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.setHeader('Content-Disposition', `attachment; filename=archive-vault-${entity || 'all'}-${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(results.map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}) })));
  });
});

// POST restore an archived record (re-actives cases/users; re-inserts reports/messages)
app.post('/api/archive-records/:id/restore', authenticate, requireRole('CHO'), (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM archive_records WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Archive record not found.' });
    const rec = rows[0];
    const data = typeof rec.data === 'string' ? JSON.parse(rec.data) : (rec.data || {});
    const actor = { id: req.user.user_id, name: req.user.name, role: req.user.role };
    const finish = (restoredNote) => {
      db.query('UPDATE archive_records SET restored_at = NOW(), restored_by = ? WHERE id = ?', [req.user.name, id], (uErr) => {
        if (uErr) console.error('Archive restore mark error:', uErr.message);
        createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Restored', 'Archive Vault', `${restoredNote} (from archive #${id})`);
        res.json({ message: 'Record restored successfully.' });
      });
    };
    if (rec.entity === 'case') {
      const caseId = rec.entity_id || data.case_id;
      db.query('UPDATE disease_cases SET is_archived = 0 WHERE case_id = ?', [caseId], (uErr, uRes) => {
        if (uErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
        if (!uRes || uRes.affectedRows === 0) return res.status(404).json({ error: 'Original case not found in disease_cases.' });
        finish(`Restored archived case #${caseId} for ${data.patient_name || 'Unknown Patient'}`);
      });
    } else if (rec.entity === 'user') {
      const userId = rec.entity_id || data.user_id;
      db.query('UPDATE users SET is_archived = 0 WHERE user_id = ?', [userId], (uErr, uRes) => {
        if (uErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
        if (!uRes || uRes.affectedRows === 0) return res.status(404).json({ error: 'Original user not found in users.' });
        finish(`Restored archived user #${userId} (${data.full_name || 'Unknown'})`);
      });
    } else if (rec.entity === 'generated_report') {
      db.query(`INSERT INTO generated_reports (title, period, entity, details, cho_unit, snapshot_logs, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.title, data.period || null, data.entity || null, data.details || null, data.cho_unit || null,
         JSON.stringify(typeof data.snapshot_logs === 'string' ? JSON.parse(data.snapshot_logs) : (data.snapshot_logs || [])), data.created_by || req.user.user_id],
        (iErr, iRes) => {
          if (iErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
          finish(`Restored generated report "${data.title || '(untitled)'}" (new ID ${iRes.insertId})`);
        });
    } else if (rec.entity === 'contact_message') {
      db.query(`INSERT INTO contact_messages (name, target_cho_unit, disease_name, message, age, gender, contact_no, address, barangay, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.target_cho_unit || null, data.disease_name || null, data.message || '', data.age || null, data.gender || null,
         data.contact_no || null, data.address || null, data.barangay || null, new Date(data.created_at || Date.now())],
        (iErr, iRes) => {
          if (iErr) return res.status(500).json({ error: 'Internal database error. Please try again.' });
          finish(`Restored contact message from ${data.name || 'Unknown'} (new ID ${iRes.insertId})`);
        });
    } else {
      finish(`Restored ${rec.entity} #${rec.entity_id || ''}`);
    }
  });
});

// DELETE permanently remove an archive record from the vault
app.delete('/api/archive-records/:id', authenticate, requireRole('CHO'), (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM archive_records WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Archive record not found.' });
    createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Deleted', 'Archive Vault', `Permanently removed archive record #${id}`);
    res.json({ message: 'Archive record removed successfully.' });
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
        AND u.is_archived = 0
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

        // Lockout guard: block login while a lockout window is active
        if (user.login_locked_until && new Date(user.login_locked_until) > new Date()) {
            const mins = Math.max(1, Math.ceil((new Date(user.login_locked_until) - new Date()) / 60000));
            console.warn(`[AUTH-LOCK] ${email} is locked out. Retry in ~${mins} min.`);
            return res.status(429).json({
                error: `Too many failed login attempts. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}. Please try again later.`
            });
        }

        // Verify password: try bcrypt first, fallback to plaintext for legacy accounts
        let passwordMatch = false;
        try {
          passwordMatch = bcrypt.compareSync(password, user.password);
        } catch (pwErr) {
          console.warn('[AUTH] bcrypt compare for', email, 'threw:', pwErr.message);
        }
        const plaintextMatch = !passwordMatch && user.password === password;

        if (!passwordMatch && !plaintextMatch) {
          const stored = user.password || '';
          console.warn('[AUTH-FAIL]', JSON.stringify({
            email,
            role,
            storedPrefix: stored.slice(0, 7),
            storedLen: stored.length,
            looksLikeBcrypt: /^\$2[abxy]\$/.test(stored),
          }));
          // Count the failed attempt against the brute-force lockout policy
          db.query('UPDATE users SET login_attempts = login_attempts + 1 WHERE user_id = ?', [user.user_id], (attemptErr) => {
              if (attemptErr) return;
              db.query('SELECT login_attempts FROM users WHERE user_id = ?', [user.user_id], (err2, rows) => {
                  const attempts = (rows && rows[0] && rows[0].login_attempts) || 0;
                  if (attempts >= MAX_LOGIN_ATTEMPTS) {
                      const lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
                      db.query('UPDATE users SET login_attempts = 0, login_locked_until = ? WHERE user_id = ?', [lockedUntil, user.user_id], (lockErr) => {
                          if (!lockErr) {
                              console.warn(`[AUTH-LOCK] ${email} exceeded ${MAX_LOGIN_ATTEMPTS} failed attempts. Account locked until ${lockedUntil.toISOString()}.`);
                          }
                      });
                      return res.status(429).json({ error: 'Too many failed login attempts. This account is locked for 5 minutes. Please try again later.' });
                  }
                  const remaining = MAX_LOGIN_ATTEMPTS - attempts;
                  return res.status(401).json({ error: `Invalid credentials or account not found. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.` });
              });
          });
          return;
        }

        // Successful login - clear failed-attempt counters
        db.query('UPDATE users SET login_attempts = 0, login_locked_until = NULL WHERE user_id = ?', [user.user_id]);

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
            const ctx = (context || '').toString().trim();
            const selectedBarangay = ctx.replace(/^Brgy\.\s*/i, '').toLowerCase();
            const assignedBarangay = (user.assigned_barangay_name || '').trim().toLowerCase();

            if (!assignedBarangay) {
                return res.status(403).json({ 
                    error: 'Your account has no assigned barangay. Please contact your CHO administrator.' 
                });
            }

            if (selectedBarangay !== assignedBarangay) {
                const ctxLabel = ctx.replace(/^Brgy\.\s*/i, '').trim();
                return res.status(403).json({ 
                    error: `Access denied. You are assigned to Brgy. ${user.assigned_barangay_name}, not Brgy. ${ctxLabel}.` 
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

        if (!user.two_fa_enabled) {
            createAuditLog(user.user_id, user.full_name, user.role, user.cho_unit || null, user.assigned_barangay_name, 'Logged In', 'System', `Login from ${device || 'Unknown Device'} at ${location || 'Unknown Location'} on ${phTimestamp()}`);
        }

        const respondLogin = (token) => {
            return res.status(200).json({
                message: 'Success',
                requires2FA: !!user.two_fa_enabled,
                mustChangePassword: !!user.must_change_password,
                isGeneratorPassword: !!(user.initial_password),
                token: token || null,
                user: {
                    id: user.user_id,
                    name: user.full_name,
                    role: user.role,
                    barangay: user.assigned_barangay_name || null
                }
            });
        };

        if (user.two_fa_enabled) {
            return respondLogin(null);
        }

        createSessionAndSignToken(user, device, location, req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '', (err, token) => {
            if (err) return res.status(500).json({ error: 'Failed to create login session.' });
            respondLogin(token);
        });
    });
});

// ROUTE: Log out (audit trail) - identity derived from the JWT, not client-supplied body
app.post('/api/logout', authenticate, (req, res) => {
    const userId = req.user ? req.user.user_id : null;
    const userName = req.user ? req.user.name : 'Unknown';
    const userRole = req.user ? req.user.role : 'System';
    const barangay = req.user ? req.user.barangay : null;
    // Revoke this session so its JWT dies immediately
    if (req.user && req.user.token_id) {
        db.query('UPDATE user_sessions SET revoked_at = NOW() WHERE token_id = ? AND revoked_at IS NULL', [req.user.token_id], (rErr) => {
            if (rErr) console.error('[SESSION] logout revoke error:', rErr.message);
        });
    }
    const writeLogoutAudit = (choUnit) => {
        createAuditLog(userId, userName, userRole, choUnit, barangay, 'Logged Out', 'System', `Logout at ${phTimestamp()}`);
    };
    if (userId) {
        db.query('SELECT cho_unit FROM users WHERE user_id = ?', [userId], (err, rows) => {
            writeLogoutAudit((!err && rows && rows[0]) ? rows[0].cho_unit : null);
        });
    } else {
        writeLogoutAudit(null);
    }
    res.json({ ok: true });
});

// ROUTE: Register new user
app.post('/api/register', (req, res) => {
    const { name, username: bodyUsername, email, mobile, password, role, context } = req.body;
    const enforcedRole = 'BHW'; // Public self-registration is BHW-only. CHO accounts must be created via User Management by an existing CHO admin.

    const pwErrors = validatePasswordStrength(password);
    if (pwErrors.length > 0) {
      return res.status(400).json({ message: pwErrors.join(' ') });
    }

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
            return res.status(500).json({ message: 'Registration failed. Please try again.' });
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
    db.query(insertQuery, [username, name, email, mobile || null, hashedPw, password, enforcedRole, assignedBarangayId], (err, result) => {
        if (err) {
            console.error("MySQL Registration Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }
            return res.status(500).json({ message: 'Registration failed. Please try again.' });
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
app.post('/api/sync', authenticate, (req, res) => {
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
                const ts = p._offlineTimestamp ? new Date(p._offlineTimestamp) : new Date();
                const autoCls = diseaseClassification(p.disease_name);
                const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(p.case_type) ? p.case_type : autoCls.case_type;
                const resolvedDiseaseType = p.disease_type != null && String(p.disease_type).trim() !== '' ? String(p.disease_type).trim().slice(0, 100) : null;
                withTransaction((t) => {
                t.q(
                    `INSERT INTO disease_cases
                        (patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported, created_by, vaccination_status, vaccine_expiry_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    p.patient_name, dId, p.age, p.severity || 'Moderate', resolvedCaseType, resolvedDiseaseType,
                    p.gender || 'Other', p.status || 'Active', p.contact,
                    p.onset_date, p.address, p.barangay_id, p.symptoms,
                    p.physician, p.latitude, p.longitude, ts, p._offlineUserId || null,
                    p.vaccination_status || null, p.vaccine_expiry_date || null
                ], (err, result) => {
                    if (err) {
                        console.error('[Sync] Create failed:', err.message);
                        t.rollback();
                        results.push({ type, error: 'Internal database error. Please try again.' });
                        return processNext(index + 1);
                    }
                    // Audit log is written inside the transaction
                    if (p._offlineUserId) {
                        createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', null, null, null, 'Synced Case (Offline)', 'Disease Case', `Offline case synced: ${p.patient_name} - ${p.disease_name}`, t);
                    }
                    t.commit(() => {
                        processed++;
                        results.push({ type, newCaseId: result.insertId });
                        // Mirror the online POST /api/cases notifications for synced offline creates
                        db.query(`
                            SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id, dc.severity, dc.status
                            FROM disease_cases dc
                            LEFT JOIN diseases d ON dc.disease_id = d.id
                            LEFT JOIN barangays b ON dc.barangay_id = b.id
                            WHERE dc.case_id = ?
                        `, [result.insertId], (nErr, nRows) => {
                            if (!nErr && nRows && nRows.length > 0) {
                                const info = nRows[0];
                                const title = 'New Case Reported';
                                const message = `A new case of ${info.disease_name} (${info.severity}) has been reported for ${info.patient_name} in Barangay ${info.barangay_name || 'N/A'}.`;
                                createNotificationForUsers(title, message, 'info', 'ManageCases', info.barangay_id, 'new_case_reported', null, result.insertId);
                                checkAndAlertHighRisk(info.barangay_id, info.barangay_name);
                            }
                        });
                        processNext(index + 1);
                    });
                });
                }, (txErr) => {
                    console.error('[Sync] Create transaction failed:', txErr && txErr.message);
                    results.push({ type, error: 'Sync create failed. No changes were saved.' });
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
                const autoCls = diseaseClassification(p.disease_name);
                const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(p.case_type) ? p.case_type : autoCls.case_type;
                const resolvedDiseaseType = p.disease_type != null && String(p.disease_type).trim() !== '' ? String(p.disease_type).trim().slice(0, 100) : null;
                db.query(
                    `UPDATE disease_cases SET
                        patient_name=?, disease_id=?, age=?, severity=?, case_type=?, disease_type=?, gender=?, status=?,
                        contact=?, onset_date=?, address=?, barangay_id=?, symptoms=?,
                        physician=?, latitude=?, longitude=?, vaccination_status=?, vaccine_expiry_date=?, updated_at=NOW()
                    WHERE case_id=?
                `, [
                    p.patient_name, dId, p.age, p.severity, resolvedCaseType, resolvedDiseaseType,
                    p.gender, p.status, p.contact, p.onset_date, p.address,
                    p.barangay_id, p.symptoms, p.physician, p.latitude, p.longitude,
                    p.vaccination_status || null, p.vaccine_expiry_date || null, caseId
                ], (err) => {
                    if (err) {
                        results.push({ type, error: 'Internal database error. Please try again.' });
                    } else {
                        processed++;
                        results.push({ type, caseId });
                        if (p._offlineUserId) {
                            createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', null, null, null, 'Synced Edit (Offline)', 'Disease Case', `Offline edit synced for case #${caseId}`);
                        }
                        // Mirror the online PUT /api/cases/:id notifications for synced offline edits
                        db.query(`
                            SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id, dc.status
                            FROM disease_cases dc
                            LEFT JOIN diseases d ON dc.disease_id = d.id
                            LEFT JOIN barangays b ON dc.barangay_id = b.id
                            WHERE dc.case_id = ?
                        `, [caseId], (nErr, nRows) => {
                            if (!nErr && nRows && nRows.length > 0) {
                                const info = nRows[0];
                                const title = 'Case Status Updated';
                                const message = `The case status for ${info.patient_name} (${info.disease_name}) in Barangay ${info.barangay_name || 'N/A'} has been changed to ${info.status}.`;
                                createNotificationForUsers(title, message, 'info', 'ManageCases', info.barangay_id, 'case_status_updated', null, caseId);
                                checkAndAlertHighRisk(info.barangay_id, info.barangay_name);
                            }
                        });
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
            // Soft archive instead of permanent delete - the record stays in the DB
            // so the patient can be found again if they resurface in the future.
            db.query(`SELECT dc.patient_name, d.name AS disease_name, b.name AS barangay_name, dc.barangay_id
                      FROM disease_cases dc
                      LEFT JOIN diseases d ON dc.disease_id = d.id
                      LEFT JOIN barangays b ON dc.barangay_id = b.id
                      WHERE dc.case_id = ?`, [caseId], (cErr, cRows) => {
                const cInfo = (!cErr && cRows && cRows.length > 0) ? cRows[0] : null;
                db.query('UPDATE disease_cases SET is_archived = 1 WHERE case_id = ?', [caseId], (err) => {
                    if (err) {
                        results.push({ type, error: 'Internal database error. Please try again.' });
                    } else {
                        processed++;
                        results.push({ type, caseId });
                        // Phase 1b: snapshot the offline-archived case into the retention archive
                        if (cInfo) {
                          archiveRecord('case', caseId, `${cInfo.disease_name || 'Case'} - ${cInfo.patient_name || 'Unknown'}`, cInfo, {
                            id: payload && payload._offlineUserId, name: (payload && payload._offlineUserName) || 'Offline User', role: null,
                          }, 'Synced Archive (Offline)');
                        }
                        if (payload && payload._offlineUserId) {
                            createAuditLog(payload._offlineUserId, payload._offlineUserName || 'Offline User', null, null, null, 'Synced Archive (Offline)', 'Disease Case', `Offline archive synced for case #${caseId}`);
                        }
                        if (cInfo) {
                            const title = 'Case Archived';
                            const message = `Case for ${cInfo.patient_name} (${cInfo.disease_name}) in Barangay ${cInfo.barangay_name || 'N/A'} has been archived.`;
                            createNotificationForUsers(title, message, 'delete', 'ManageCases', cInfo.barangay_id, 'delete');
                        }
                    }
                    processNext(index + 1);
                });
            });
        } else if (type === 'message' && endpoint === '/api/contact-messages') {
            const p = payload || {};
            const selectedSyncedBarangay = (p.targetBarangay || '').trim();
            const detectedBarangay = detectBarangayFromAddress(p.address);
            const finalSyncedBarangay = selectedSyncedBarangay || detectedBarangay || p.barangay || null;
            db.query(
                `INSERT INTO contact_messages (name, target_cho_unit, disease_name, message, age, gender, contact_no, address, barangay, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.name, p.targetCho || null, p.disease || p.disease_name || null, p.message, p.age || null, p.gender || null, p.contact || p.mobile || null, p.address || null, finalSyncedBarangay || null, new Date(p._offlineTimestamp || Date.now())],
                (err, insRes) => {
                    if (err) {
                        results.push({ type, error: 'Internal database error. Please try again.' });
                    } else {
                        processed++;
                        results.push({ type, success: true });
                        // Phase 1b: snapshot the offline resident message into the retention archive
                        if (!payload._offlineUserId) {
                            archiveRecord('contact_message', (insRes && insRes.insertId) || null, p.name || 'Resident Message', {
                                id: (insRes && insRes.insertId) || null, name: p.name, target_cho_unit: p.targetCho || null,
                                disease_name: p.disease || p.disease_name || null, message: p.message,
                                age: p.age || null, gender: p.gender || null, contact_no: p.contact || p.mobile || null,
                                address: p.address || null, barangay: finalSyncedBarangay || null,
                            }, null, 'Received (Offline)');
                        }
                    }
                    processNext(index + 1);
                }
            );
        } else if (type === 'add_request' && endpoint === '/api/cases/request-add') {
            // Offline BHW submission → creates a pending add request (CHOs approve later)
            const p = payload || {};
            const resolveBarangay = (cb) => {
              if (p.barangay_id) {
                db.query('SELECT name FROM barangays WHERE id = ?', [p.barangay_id], (bErr, bRes) => {
                  cb((!bErr && bRes.length > 0) ? bRes[0].name : null);
                });
              } else cb(null);
            };
            resolveBarangay((barangayName) => {
            const selectedSyncedBarangay = (p.targetBarangay || '').trim();
            const detectedBarangay = detectBarangayFromAddress(p.address);
            const finalSyncedBarangay = selectedSyncedBarangay || detectedBarangay || p.barangay || null;
            
              let targetChoUnit = p.submitter_cho_unit || null;
              if (detectedBarangay) targetChoUnit = getChoUnitForBarangayName(detectedBarangay) || targetChoUnit;
              if (barangayName) targetChoUnit = getChoUnitForBarangayName(barangayName) || targetChoUnit;
              const autoCls = diseaseClassification(p.disease_name);
              const resolvedCaseType = ['Suspected', 'Probable', 'Confirmed'].includes(p.case_type) ? p.case_type : autoCls.case_type;
              const resolvedDiseaseType = p.disease_type != null && String(p.disease_type).trim() !== '' ? String(p.disease_type).trim().slice(0, 100) : null;
              let finalLat = p.latitude || null;
              let finalLng = p.longitude || null;
              if (barangayName) {
                const clamped = geoSnap.snapToBarangay(p.longitude, p.latitude, barangayName, `${barangayName}|${p.address ? String(p.address).replace(/[^0-9a-zA-Z ]/g, ' ') : 'C'}`);
                if (clamped) { finalLat = String(clamped[0]); finalLng = String(clamped[1]); }
              }
              db.query(
                `INSERT INTO case_add_requests
                  (patient_name, disease_name, age, severity, case_type, disease_type, gender, case_status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude,
                   requested_by, requested_by_name, from_barangay_name, target_cho_unit, note,
                   vaccination_status, vaccine_expiry_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.patient_name, p.disease_name, p.age || 0, p.severity || 'Moderate', resolvedCaseType, resolvedDiseaseType, p.gender || 'Male', p.status || 'Active', p.contact || null, p.onset_date || null, p.address || null,
                  p.barangay_id || null, p.symptoms || null, p.physician || null, finalLat, finalLng,
                  p._offlineUserId || null, p._offlineUserName || 'Offline BHW', p.from_barangay_name || null, targetChoUnit || null, p.note || null,
                  p.vaccination_status || null, p.vaccine_expiry_date || null],
                (err, result) => {
                  if (err) {
                    results.push({ type, error: 'Internal database error. Please try again.' });
                  } else {
                    processed++;
                    results.push({ type, requestId: result.insertId });
                    if (p._offlineUserId) {
                      createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', 'BHW', null, p.from_barangay_name || null, 'Synced Add Request (Offline)', 'Disease Case',
                        `Offline case submission queued for approval: ${p.patient_name} - ${p.disease_name}`);
                    }
                  }
                  processNext(index + 1);
                }
              );
            });
        } else if ((type === 'edit_request' || type === 'edit-request') && endpoint && endpoint.startsWith('/api/cases/') && endpoint.endsWith('/request-edit')) {
            // Offline BHW edit → creates a pending edit request (with proposed values) for CHO review
            const p = payload || {};
            const caseId = endpoint.split('/')[3];
            const proposedJson = (p.proposed_data && Object.keys(p.proposed_data).length > 0) ? JSON.stringify(p.proposed_data) : null;
            db.query(
              'INSERT INTO case_edit_requests (case_id, requested_by, requested_by_name, from_barangay_name, target_cho_unit, note, proposed_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [caseId, p._offlineUserId || null, p._offlineUserName || 'Offline BHW', p.from_barangay_name || null, p.target_cho_unit || null, p.note || '(offline edit)', proposedJson],
              (err, result) => {
                if (err) {
                  results.push({ type, error: 'Internal database error. Please try again.' });
                } else {
                  processed++;
                  results.push({ type, requestId: result.insertId });
                  if (p._offlineUserId) {
                    createAuditLog(p._offlineUserId, p._offlineUserName || 'Offline User', 'BHW', null, p.from_barangay_name || null, 'Synced Edit Request (Offline)', 'Disease Case',
                      `Offline edit request for case #${caseId} submitted for CHO review`);
                  }
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
app.get('/api/pending-registrations', authenticate, (req, res) => {
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
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        res.json(rows);
    });
});

// PUT /api/pending-registrations/:id/approve
app.put('/api/pending-registrations/:id/approve', authenticate, (req, res) => {
    const { id } = req.params;
    db.query(
        `SELECT user_id, full_name, email, assigned_barangay_id FROM users WHERE user_id = ? AND status = 'pending'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (rows.length === 0) return res.status(404).json({ error: 'Registration not found or already processed.' });
            const user = rows[0];

            db.query(
                `UPDATE users SET is_active = 1, status = 'approved' WHERE user_id = ?`,
                [id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: 'Internal database error. Please try again.' });

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
app.put('/api/pending-registrations/:id/reject', authenticate, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    db.query(
        `SELECT user_id, full_name, email FROM users WHERE user_id = ? AND status = 'pending'`,
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (rows.length === 0) return res.status(404).json({ error: 'Registration not found or already processed.' });
            const user = rows[0];

            db.query(
                `UPDATE users SET is_active = 0, status = 'rejected' WHERE user_id = ?`,
                [id],
                (err2) => {
                    if (err2) return res.status(500).json({ error: 'Internal database error. Please try again.' });

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
                              `Rejected BHW registration for ${user.full_name}${reason ? ` - Reason: ${reason}` : ''} (User ID: ${user.user_id})`);
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
            return res.status(500).json({ error: 'Account not found. Please try again.' });
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

            const resetLink = `${resolveFrontendUrl(req)}/reset-password?token=${token}&email=${encodeURIComponent(userFound.email)}`;

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
                return res.status(500).json({ error: 'Email delivery failed. Please try again or contact support.' });
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
app.post('/api/users', authenticate, requireRole('CHO'), async (req, res) => {
    const { firstName, lastName, username, email, mobile, barangayId, isActive, password, generateTempPassword, role } = req.body;

    if (!firstName || !lastName || !username || !email || !barangayId) {
        return res.status(400).json({ error: 'First name, last name, username, email, and barangay are required.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    let finalPassword = password;
    let tempPasswordGenerated = null;

    if (generateTempPassword || !password) {
        tempPasswordGenerated = generateStrongTempPassword();
        finalPassword = tempPasswordGenerated;
    } else {
        const denyTokens = [firstName, lastName, role === 'CHO' ? 'CHO' : 'BHW'];
        const pwErrors = validatePasswordStrength(password, denyTokens);
        if (pwErrors.length > 0) {
            return res.status(400).json({ error: pwErrors.join(' ') });
        }
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
        INSERT INTO users (username, full_name, email, mobile_number, password, initial_password, role, assigned_barangay_id, is_active, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    const hashedFinal = bcrypt.hashSync(finalPassword, 10);
    db.query(insertQuery, [username, fullName, email, mobile || null, hashedFinal, finalPassword, role || 'BHW', barangayId, isActive ? 1 : 0], (err, result) => {
        if (err) {
            console.error("Add user error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'A user with this username or email already exists.' });
            }
            return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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

        console.log("User added:", { username, fullName, barangayId, tempPassword: tempPasswordGenerated || null });
        createAuditLog(null, 'CHO Admin', 'CHO', null, null, 'Created', 'User Account', `Created account for ${fullName} (${role}) assigned to barangay ID ${barangayId}`);
        res.status(200).json({ message: 'User account created successfully.', user_id: result.insertId, tempPassword: tempPasswordGenerated });
    });
});

// ROUTE: Send 2FA verification email - generates a real token now. Self-service only (uses JWT identity).
app.post('/api/send-2fa-email', authenticate, (req, res) => {
    const userId = req.user ? req.user.user_id : null;
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
    db.query('SELECT email, full_name, two_fa_token, two_fa_token_expiry FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'User not found.' });
        const user = results[0];

        if (!user.email) {
            return res.status(400).json({ error: 'No email on file. Add an email in Profile Settings before enabling 2FA.' });
        }

        // Reuse a still-valid token so re-requesting the link does not invalidate the earlier email.
        const existingValid = user.two_fa_token && user.two_fa_token_expiry && new Date(user.two_fa_token_expiry).getTime() > Date.now();
        const token = existingValid ? user.two_fa_token : crypto.randomBytes(32).toString('hex');
        const expiry = existingValid ? user.two_fa_token_expiry : new Date(Date.now() + 3600000); // 1 hour

        db.query('UPDATE users SET two_fa_token = ?, two_fa_token_expiry = ? WHERE user_id = ?',
            [token, expiry, userId], async (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to save verification token.' });

            const verifyLink = `${resolveFrontendUrl(req)}/verify-2fa?token=${token}&userId=${userId}`;

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
                const brevoMsg = (err.response && err.response.data && err.response.data.message)
                    ? String(err.response.data.message)
                    : (err.message || 'Unknown Brevo error');
                const brevoCode = (err.response && err.response.data && err.response.data.code)
                    ? String(err.response.data.code)
                    : '';
                console.log(`\n🔑 FALLBACK 2FA VERIFY LINK for ${user.email}: [ ${verifyLink} ]\n`);
                return res.status(200).json({
                    message: `Email blocked by the mail service (Brevo${brevoCode ? ' ' + brevoCode : ''}: ${brevoMsg}). Use the fallback link below to activate 2FA.`,
                    fallback: true,
                    verifyLink,
                    brevoError: brevoMsg,
                });
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

// ROUTE: Disable 2FA - operates on the authenticated user's own account (IDOR-safe)
app.post('/api/disable-2fa', authenticate, (req, res) => {
    const userId = req.user ? req.user.user_id : null;
    if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
    db.query('UPDATE users SET two_fa_enabled = 0, two_fa_token = NULL, two_fa_token_expiry = NULL WHERE user_id = ?',
        [userId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to disable 2FA.' });
        return res.status(200).json({ message: '2FA disabled.' });
    });
});

// ROUTE: Send login OTP (called after password is verified, only if 2FA is enabled)
app.post('/api/send-login-otp', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User id required.' });

    const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
    const throttle = simpleRateLimit(`otp:${userId}:${ip}`, 5, 60000);
    if (!throttle.allowed) {
        return res.status(429).json({ error: 'Too many code requests. Please wait before trying again.' });
    }

    db.query('SELECT email, full_name FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'User not found.' });
        const user = results[0];

        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiry = new Date(Date.now() + 600000); // 10 minutes

        // Do NOT reset login_otp_attempts here - the attempt guard must persist across resends
        db.query('UPDATE users SET login_otp = ?, login_otp_expiry = ? WHERE user_id = ?',
            [otp, expiry, userId], async (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to generate code.' });

            try {
                await sendBrevoEmail(user.email, 'Cabuyao Health - Your Login/2FA Verification Code', `
                <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#16171d;border:1px solid #2e303a;border-radius:8px;overflow:hidden;">
                    <div style="background:#0d9488;padding:24px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:28px;">CABUYAO HEALTH</h1>
                    </div>
                    <div style="background:#1f2028;padding:40px 32px;text-align:center;">
                        <p style="color:#f3f4f6;font-size:16px;">Hi ${user.full_name}, here is your login/2FA code:</p>
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

// ROUTE: Verify login OTP - completes the 2FA login step
app.post('/api/verify-login-otp', (req, res) => {
    const { userId, otp, device, location } = req.body;

    const query = `
        SELECT u.*, b.name AS assigned_barangay_name
        FROM users u
        LEFT JOIN barangays b ON u.assigned_barangay_id = b.id
        WHERE u.user_id = ? AND u.login_otp = ? AND u.login_otp_expiry > NOW() AND u.is_active = 1 AND u.is_archived = 0
    `;
    db.query(query, [userId, otp], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (results.length === 0) {
            db.query('UPDATE users SET login_otp_attempts = login_otp_attempts + 1 WHERE user_id = ?', [userId], (attemptErr) => {
                if (attemptErr) return res.status(500).json({ error: 'Database error.' });
                db.query('SELECT login_otp_attempts FROM users WHERE user_id = ?', [userId], (err2, rows) => {
                    if (err2) return res.status(500).json({ error: 'Database error.' });
                    const attempts = (rows && rows[0] && rows[0].login_otp_attempts) || 0;
                    if (attempts >= 5) {
                        return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code and try again.' });
                    }
                    const remaining = 5 - attempts;
                    return res.status(400).json({ error: `Invalid or expired code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
                });
            });
            return;
        }

        db.query('UPDATE users SET login_otp = NULL, login_otp_expiry = NULL, login_otp_attempts = 0 WHERE user_id = ?', [userId]);

        const user = results[0];

        db.query('UPDATE users SET login_otp = NULL, login_otp_expiry = NULL, login_otp_attempts = 0 WHERE user_id = ?', [userId]);
        createAuditLog(user.user_id, user.full_name, user.role, user.cho_unit || null, user.assigned_barangay_name || null, 'Logged In (2FA)', 'System', `Login completed via two-factor authentication on ${phTimestamp()}`);

        const respondVerified = (token) => {
            return res.status(200).json({
                message: 'Login verified.',
                token: token || null,
                mustChangePassword: !!user.must_change_password,
                isGeneratorPassword: !!(user.initial_password),
                user: {
                    id: user.user_id,
                    name: user.full_name,
                    role: user.role,
                    barangay: user.assigned_barangay_name || null
                }
            });
        };

        createSessionAndSignToken(user, device, location, req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '', (err, token) => {
            if (err) return res.status(500).json({ error: 'Failed to create login session.' });
            respondVerified(token);
        });
    });
});


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
                        isCho = true; // broadcast - all CHOs see it
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
                    // 'high_risk_alert' is always delivered (automatic) within the user's assigned scope
                    const eventAllowed = !eventType || eventType === 'delete' || eventType === 'high_risk_alert' || prefs[eventType] == true;

                    // 1. In-app notification (Push) - only if push_notifications is ON
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

                    // 3. SMS notification - staff-only (recipients are CHO/BHW accounts; residents are never in this query)
                    const clearSmsMessage = message.replace(/[^\x20-\x7E]/g, '').trim();
                    if (eventAllowed && prefs.sms_notifications && user.mobile_number) {
                        const phNumber = toPhMobile(user.mobile_number);
                        if (phNumber) {
                            sendBrevoSms(phNumber, clearSmsMessage || title).catch(err =>
                                console.error(`SMS notification failed for user ${user.user_id}:`, err.message)
                            );
                        }
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
app.get('/api/notifications', authenticate, (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500) : null;
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset, 10) || 0, 0) : 0;
    db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC' + (limit ? ` LIMIT ${limit} OFFSET ${offset}` : ''),
        limit ? [userId] : [userId],
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (!limit) return res.json(results);
            db.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?', [userId], (cErr, cnt) => {
                if (cErr) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
                return res.json({ rows: results, total: cnt && cnt[0] ? cnt[0].total : results.length, limit, offset });
            });
        }
    );
});

// POST: Manually create a notification (optional but useful)
app.post('/api/notifications', authenticate, (req, res) => {
    const { user_id, title, message, type, link_to } = req.body;
    db.query(
        'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
        [user_id, title, message, type || 'info', link_to || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            return res.status(201).json({ message: 'Notification created', id: result.insertId });
        }
    );
});

// POST /api/sms/test - CHO-only, sends a staff emergency SMS to a single PH mobile (self-test of Brevo SMS path)
app.post('/api/sms/test', authenticate, (req, res) => {
    if (!req.user || req.user.role !== 'CHO') {
        return res.status(403).json({ error: 'CHO access only' });
    }
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });
    const phNumber = toPhMobile(to);
    if (!phNumber) return res.status(400).json({ error: 'Invalid Philippine mobile number' });
    sendBrevoSms(phNumber, String(message)).then(() => {
        return res.json({ message: 'SMS queued to Brevo', recipient: phNumber });
    }).catch(() => {
        return res.status(500).json({ error: 'SMS send failed' });
    });
});

// PUT: Mark notification as read
app.put('/api/notifications/:id/read', authenticate, (req, res) => {
    const { id } = req.params;
    db.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ?',
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            return res.json({ message: 'Notification marked as read' });
        }
    );
});

// DELETE: Dismiss a specific notification
app.delete('/api/notifications/:id', authenticate, (req, res) => {
    const { id } = req.params;
    db.query(
        'DELETE FROM notifications WHERE id = ?',
        [id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            return res.json({ message: 'Notification dismissed' });
        }
    );
});

// DELETE (bulk): Dismiss all notifications for a specific user
app.delete('/api/notifications', authenticate, (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    db.query(
        'DELETE FROM notifications WHERE user_id = ?',
        [userId],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            return res.json({ message: 'All notifications dismissed' });
        }
    );
});


// GET: Fetch notification preferences for a user
app.get('/api/notification-preferences/:userId', authenticate, (req, res) => {
    const { userId } = req.params;
    db.query('SELECT * FROM notification_preferences WHERE user_id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
app.put('/api/notification-preferences/:userId', authenticate, (req, res) => {
    const { userId } = req.params;
    const {
        push_notifications, email_notifications, sms_notifications,
        new_case_reported, case_status_updated, high_risk_alert,
        weekly_summary, system_maintenance, updated_case_reported,
        vaccine_advisories,
    } = req.body;

    db.query(
        `INSERT INTO notification_preferences 
        (user_id, push_notifications, email_notifications, sms_notifications, 
         new_case_reported, case_status_updated, high_risk_alert, 
         weekly_summary, system_maintenance, updated_case_reported, vaccine_advisories)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        push_notifications = VALUES(push_notifications),
        email_notifications = VALUES(email_notifications),
        sms_notifications = VALUES(sms_notifications),
        new_case_reported = VALUES(new_case_reported),
        case_status_updated = VALUES(case_status_updated),
        high_risk_alert = VALUES(high_risk_alert),
        weekly_summary = VALUES(weekly_summary),
        system_maintenance = VALUES(system_maintenance),
        updated_case_reported = VALUES(updated_case_reported),
        vaccine_advisories = VALUES(vaccine_advisories)`,
        [userId,
         push_notifications ? 1 : 0, email_notifications ? 1 : 0, sms_notifications ? 1 : 0,
         new_case_reported ? 1 : 0, case_status_updated ? 1 : 0, high_risk_alert ? 1 : 0,
         weekly_summary ? 1 : 0, system_maintenance ? 1 : 0, updated_case_reported ? 1 : 0,
         vaccine_advisories ? 1 : 0],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            return res.json({ message: 'Preferences saved successfully' });
        }
    );
});

// ==========================================
// 5. STORAGE AND EXPORT ROUTES
// ==========================================

// GET /api/storage-stats - real counts and estimated storage usage
app.get('/api/storage-stats', authenticate, (req, res) => {
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
  .catch(err => res.status(500).json({ error: 'Something went wrong. Please try again.' }));
});

// GET /api/export-all - export all cases as JSON or CSV
app.get('/api/export-all', authenticate, (req, res) => {
  const { format } = req.query;

  const sql = `
    SELECT dc.case_id, dc.patient_name, dc.age, dc.gender, dc.contact,
           dc.address, dc.symptoms, dc.physician, dc.onset_date,
           dc.severity, dc.case_type, dc.disease_type, dc.status, dc.date_reported,
           dc.latitude, dc.longitude, dc.vaccination_status, dc.vaccine_expiry_date,
           d.name AS disease_name,
           b.name AS barangay_name
    FROM disease_cases dc
    LEFT JOIN diseases d ON dc.disease_id = d.id
    LEFT JOIN barangays b ON dc.barangay_id = b.id
    ORDER BY dc.date_reported DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });

    if (format === 'csv') {
      const headers = 'Case ID,Patient Name,Age,Gender,Contact,Address,' +
        'Disease,Barangay,Severity,Case Type,Disease Type,Status,Onset Date,Date Reported\n';
      const rows = results.map(r =>
        `"${r.case_id}","${r.patient_name||''}","${r.age||''}",` +
        `"${r.gender||''}","${r.contact||''}","${r.address||''}",` +
        `"${r.disease_name||''}","${r.barangay_name||''}",` +
        `"${r.severity||''}","${r.case_type||''}","${r.disease_type||''}",` +
        `"${r.status||''}","${r.onset_date||''}","${r.date_reported||''}"`
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

// GET /api/backup - full data export as JSON download
app.get('/api/backup', authenticate, (req, res) => {
  if (req.user.role !== 'CHO') {
    return res.status(403).json({ error: 'Only CHO accounts may export system backups.' });
  }

  const results = {};

  db.query('SELECT * FROM disease_cases', (err, cases) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    results.disease_cases = cases;

    db.query('SELECT user_id, username, full_name, role, assigned_barangay_id, is_active, email, mobile_number, last_login, password FROM users',
      (err, users) => {
      if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      results.users = users;

      db.query('SELECT * FROM barangays', (err, barangays) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        results.barangays = barangays;

        db.query('SELECT * FROM diseases', (err, diseases) => {
          if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
          results.diseases = diseases;

          db.query('SELECT * FROM disease_categories', (err, disease_categories) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            results.disease_categories = disease_categories;

            db.query('SELECT * FROM disease_category_items', (err, disease_category_items) => {
              if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
              results.disease_category_items = disease_category_items;

              results.backup_date = new Date().toISOString();
              results.system = 'Cabuyao CDMS';
              results.version = '1.1';

              createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Backup', 'System Data', 'CHO exported a full system backup');

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

// ==========================================
// RESIDENT PORTAL ROUTES
// ==========================================

// POST /api/contact-messages - Resident contact form submission
app.post('/api/contact-messages', (req, res) => {
  const { name, targetCho, targetBarangay, disease, message, age, gender, contact, address } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  const selectedBarangay = (targetBarangay || '').trim();
  const detectedBarangay = detectBarangayFromAddress(address);
  const finalBarangay = selectedBarangay || detectedBarangay || null;
  db.query(
    `INSERT INTO contact_messages (name, target_cho_unit, disease_name, message, age, gender, contact_no, address, barangay)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, targetCho || null, disease || null, message, age || null, gender || null, contact || null, address || null, finalBarangay],
    (err, result) => {
      if (err) {
        console.error('Error saving contact message:', err.message);
        return res.status(500).json({ error: 'Failed to save message.' });
      }

      // Phase 1b: snapshot the resident message into the retention archive
      archiveRecord('contact_message', result.insertId, name, {
        id: result.insertId, name, target_cho_unit: targetCho || null, disease_name: disease || null,
        message, age: age || null, gender: gender || null, contact_no: contact || null,
        address: address || null, barangay: finalBarangay,
      }, null, 'Received');

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

      // Notify the BHW(s) of the target barangay - respects their push preference
      // (inbox ALWAYS receives it regardless; this row only controls the bell alert)
      if (finalBarangay) {
        db.query(
          `SELECT u.user_id FROM users u
           INNER JOIN notification_preferences np ON u.user_id = np.user_id
           WHERE u.role = 'BHW' AND np.push_notifications = 1 AND u.assigned_barangay_id IN (
             SELECT id FROM barangays WHERE name = ?
           )`,
          [finalBarangay],
          (err2, users) => {
            if (!err2 && users.length > 0) {
              users.forEach(u => {
                db.query(
                  `INSERT INTO notifications (user_id, title, message, type, link_to)
                   VALUES (?, ?, ?, ?, ?)`,
                  [u.user_id, 'New Resident Message', `A resident from ${finalBarangay} sent you a message.`, 'message', 'Manage Cases']
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

// GET /api/contact-messages - Retrieve contact messages (for CHO/BHW inbox)
app.get('/api/contact-messages', authenticate, (req, res) => {
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
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json(results);
  });
});

// PUT /api/contact-messages/:id/read - Mark message as read
app.put('/api/contact-messages/:id/read', authenticate, (req, res) => {
  db.query('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json({ message: 'Message marked as read.' });
  });
});

// PUT /api/contact-messages/:id/pending - Mark message as pending (BHW reviewing)
app.put('/api/contact-messages/:id/pending', authenticate, (req, res) => {
  db.query("UPDATE contact_messages SET status = 'pending' WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json({ message: 'Message marked as pending.' });
  });
});

// PUT /api/contact-messages/:id/reject - Reject a resident message
app.put('/api/contact-messages/:id/reject', authenticate, (req, res) => {
  db.query("UPDATE contact_messages SET status = 'rejected', is_read = 1 WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json({ message: 'Message rejected.' });
  });
});

// PUT /api/contact-messages/:id/accept - Convert contact message to a disease case
app.put('/api/contact-messages/:id/accept', authenticate, (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM contact_messages WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found.' });
    const msg = rows[0];

    db.query('SELECT id FROM diseases WHERE LOWER(name) = LOWER(?)', [msg.disease_name || ''], (dErr, dRes) => {
      const diseaseId = dRes && dRes.length > 0 ? dRes[0].id : null;
      db.query(
        `INSERT INTO disease_cases
         (patient_name, disease_id, age, severity, gender, status, contact, onset_date, address, symptoms, date_reported,
          vaccination_status, vaccine_expiry_date)
         VALUES (?, ?, ?, 'Mild', ?, 'Active', ?, NULL, ?, ?, NOW(), NULL, NULL)`,
        [msg.name, diseaseId, msg.age || 0, msg.gender || 'Male', msg.contact_no || null, msg.address || null, msg.message || ''],
        (insertErr, result) => {
          if (insertErr) {
            console.error('Contact message accept insert error:', insertErr.message);
            return res.status(500).json({ error: 'Internal database error. Please try again.' });
          }
          const caseId = result.insertId;
          db.query("UPDATE contact_messages SET status = 'accepted', is_read = 1 WHERE id = ?", [id], (updateErr) => {
            if (updateErr) {
              console.error('Contact message accept update error:', updateErr.message);
              return res.status(500).json({ error: 'Internal database error. Please try again.' });
            }
            res.json({ message: 'Message accepted as case.', case_id: caseId });
          });
        }
      );
    });
  });
});

// GET /api/disease_cases/public-summary - Public case counts per barangay
app.get('/api/disease_cases/public-summary', (req, res) => {
  const sql = `
    SELECT b.name AS barangay_name, COUNT(dc.case_id) AS case_count
    FROM barangays b
    LEFT JOIN disease_cases dc ON dc.barangay_id = b.id
    GROUP BY b.id, b.name
    ORDER BY b.name
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    res.json(results);
  });
});

// GET /api/disease_cases/public-disease-counts - Per-disease case counts for a barangay
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
    if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
app.get('/api/weekly-summary', authenticate, (req, res) => {
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
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
            }).catch(err => res.status(500).json({ error: 'Something went wrong. Please try again.' }));
        }
    );
});

// ── Shared weekly summary helpers (used by cron + trigger endpoint) ──
function buildWeeklyHtmlAndPlain(summary, barangays, diseases, severities, scopeLabel) {
    summary = summary || {}; // zero-case scopes still render a "no data" summary instead of crashing
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

    const scopeTitle = scopeLabel ? ` - ${scopeLabel}` : '';
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

// Weekly Summary - Friday 5PM cron (scoped per user / CHO unit / BHW barangay)
function runWeeklySummary() {
    console.log('⏰ Running weekly summary delivery...');

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
        });
    }

    // 1. Fetch all eligible users with scope info
    db.query(
        `SELECT u.user_id, u.role, u.assigned_barangay_id, b.name AS barangay_name, u.email, u.full_name
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
}

// Every Friday at 5PM
cron.schedule('0 17 * * 5', () => {
    console.log('⏰ Running weekly summary cron job (Friday 5PM)...');
    runWeeklySummary();
});

// Manual run for testing/on-demand (CHO only)
app.post('/api/weekly-summary/run', authenticate, (req, res) => {
    if (req.user.role !== 'CHO') {
        return res.status(403).json({ error: 'Only CHO can trigger a weekly summary run.' });
    }
    createAuditLog(
        req.user.user_id,
        req.user.name,
        req.user.role,
        null,
        req.user.barangay || null,
        'Weekly Summary',
        'System',
        'Weekly summary run triggered manually'
    );
    runWeeklySummary();
    return res.json({ message: 'Weekly summary run started. Notifications and emails will be sent to subscribed users.' });
});

// ═════════════════════════════════════════════════════════
// RETENTION PURGE + SCHEDULED DB MIRROR (Phase 2)
// ═════════════════════════════════════════════════════════
// Retention windows (days) for high-volume operational rows. The archive_records vault
// (archiveRecord) already keeps permanent snapshots of archived cases/users/reports/
// messages, and audit_logs are the CHO reports source of truth - neither is purged.
const RETENTION_WINDOWS = {
  error_logs: 90,            // logged_at
  notifications: 365,        // created_at
  contact_messages: 1095,    // created_at - 3 years
  case_inbox: 1095,          // created_at - referrals + inbox rows, 3 years
  case_status_history: 1095, // changed_at - 3 years, only for cases no longer active
};
const MIRROR_DIR = path.join(__dirname, 'backups', 'mirror');
const MIRROR_KEEP = parseInt(process.env.MIRROR_KEEP, 10) || 30;

function runRetentionPurge(cb) {
  const summary = {};
  const labels = ['error_logs', 'notifications', 'contact_messages', 'case_inbox', 'case_status_history'];
  let pending = labels.length;
  const finish = () => {
    if (--pending > 0) return;
    const parts = Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(', ') || 'nothing purged';
    console.log(`🗄️ Retention purge complete - ${parts}`);
    db.query('INSERT INTO audit_logs (user_name, user_role, action, entity, details) VALUES (?, ?, ?, ?, ?)',
      ['System', 'System', 'Retention Purge', 'System Data', `Purged ${parts} of operational data older than retention windows`],
      (err) => { if (cb) cb(summary); });
  };
  const del = (label, sql, params) => {
    db.query(sql, params, (err, result) => {
      if (err) { console.error('Retention purge failed for ' + label + ':', err.message); summary[label] = 0; }
      else summary[label] = result.affectedRows;
      finish();
    });
  };
  del('error_logs',
    'DELETE FROM error_logs WHERE logged_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [RETENTION_WINDOWS.error_logs]);
  del('notifications',
    'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [RETENTION_WINDOWS.notifications]);
  del('contact_messages',
    'DELETE FROM contact_messages WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [RETENTION_WINDOWS.contact_messages]);
  del('case_inbox',
    'DELETE FROM case_inbox WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [RETENTION_WINDOWS.case_inbox]);
  del('case_status_history',
    `DELETE FROM case_status_history WHERE changed_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND case_id NOT IN (SELECT case_id FROM disease_cases WHERE status IN ('Active','Pending','Under Treatment'))`,
    [RETENTION_WINDOWS.case_status_history]);
}

// Full-DB mirror: snapshot the 6 core tables to a dated JSON file in backups/mirror.
function snapshotCoreTables(cb) {
  const tables = ['disease_cases', 'users', 'barangays', 'diseases', 'disease_categories', 'disease_category_items'];
  const data = {};
  let i = 0;
  const next = () => {
    if (i >= tables.length) return cb(null, data);
    const tb = tables[i++];
    db.query(`SELECT * FROM ${tb}`, (err, rows) => {
      if (err) return cb(err);
      data[tb] = rows || [];
      next();
    });
  };
  next();
}

function runMirrorExport(cb) {
  snapshotCoreTables((err, data) => {
    if (err) {
      console.error('Mirror export failed:', err.message);
      return cb && cb({ error: err.message });
    }
    try {
      fs.mkdirSync(MIRROR_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const file = path.join(MIRROR_DIR, `cdms-mirror-${stamp}.json`);
      const snapshot = {
        system: 'Cabuyao CDMS', version: '2.0', backup_date: new Date().toISOString(), mirror: true,
        ...data,
      };
      fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
      const all = fs.readdirSync(MIRROR_DIR).filter(f => /^cdms-mirror-.*\.json$/.test(f));
      if (all.length > MIRROR_KEEP) {
        all.sort().slice(0, all.length - MIRROR_KEEP).forEach(f => {
          try { fs.unlinkSync(path.join(MIRROR_DIR, f)); } catch (e) { /* ignore */ }
        });
      }
      const size = fs.statSync(file).size;
      console.log(`🪞 DB mirror exported: ${file} (${(size / 1024).toFixed(1)} KB)`);
      db.query('INSERT INTO audit_logs (user_name, user_role, action, entity, details) VALUES (?, ?, ?, ?, ?)',
        ['System', 'System', 'DB Mirror', 'System Data', `Scheduled full-DB mirror exported to ${path.basename(file)} (${(size / 1024).toFixed(1)} KB)`],
        () => {});
      if (cb) cb({ file, size });
    } catch (e) {
      console.error('Mirror export write failed:', e.message);
      if (cb) cb({ error: e.message });
    }
  });
}

// NOTE (Railway): the app filesystem is ephemeral - mirror JSON files vanish on redeploy.
// For a durable DR mirror on Railway, enable real MySQL binlog replication to a second
// database (see AGENTS.md "Railway binlog replication" note) or map MIRROR_DIR to a
// persistent volume. The JSON mirror below is an on-disk snapshot for local/on-prem use.

// Monday 3AM: retention purge. Daily 2AM: full-DB mirror. Both write audit-log entries.
cron.schedule('0 3 * * 1', () => { console.log('🗄️ Running retention purge...'); runRetentionPurge(); });
cron.schedule('0 2 * * *', () => { console.log('🪞 Running scheduled DB mirror export...'); runMirrorExport(); });

// Manual CHO triggers (mirror the "Run Weekly Now" pattern in ChoSettings)
app.post('/api/maintenance/retention-run', authenticate, (req, res) => {
  if (req.user.role !== 'CHO') {
    return res.status(403).json({ error: 'Only CHO can run retention purge.' });
  }
  runRetentionPurge((summary) => res.json({ message: 'Retention purge complete.', summary }));
});

app.post('/api/maintenance/mirror-run', authenticate, (req, res) => {
  if (req.user.role !== 'CHO') {
    return res.status(403).json({ error: 'Only CHO can run mirror export.' });
  }
  runMirrorExport((info) => {
    if (info && info.error) return res.status(500).json({ error: info.error });
    res.json({ message: `DB mirror exported to ${path.basename(info.file)}.`, file: info.file, size: info.size });
  });
});

// ==========================================
// SEASONAL VACCINE ADVISORIES
// ==========================================

// Determine which advisory is active today (handles the Nov-May year wrap)
function currentSeasonAdvisory(cb) {
    const month = new Date().getMonth() + 1;
    db.query('SELECT * FROM vaccine_advisories WHERE active = 1', (err, rows) => {
        if (err) return cb(err, null);
        const found = (rows || []).find(r => {
            if (r.month_start <= r.month_end) return month >= r.month_start && month <= r.month_end;
            return month >= r.month_start || month <= r.month_end;
        });
        cb(null, found || (rows && rows[0]) || null);
    });
}

// GET all advisories (for editing/management)
app.get('/api/vaccine-advisories', (req, res) => {
    db.query('SELECT * FROM vaccine_advisories ORDER BY month_start', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        res.json(rows);
    });
});

// GET the advisory active for today's season
app.get('/api/vaccine-advisories/current', (req, res) => {
    currentSeasonAdvisory((err, row) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (!row) return res.json(null);
        res.json(row);
    });
});

// PUT update advisory content (CHO only)
app.put('/api/vaccine-advisories/:id', authenticate, requireRole('CHO'), (req, res) => {
    const { season_key, season_label, month_start, month_end, title, message, vaccine_recommendations, active } = req.body;
    if (!title || !season_label) {
        return res.status(400).json({ error: 'Season label and title are required.' });
    }
    db.query(
        `UPDATE vaccine_advisories SET season_key = ?, season_label = ?, month_start = ?, month_end = ?, title = ?, message = ?, vaccine_recommendations = ?, active = ? WHERE id = ?`,
        [season_key || null, season_label, parseInt(month_start) || null, parseInt(month_end) || null, title, message || null, vaccine_recommendations || null, active === false ? 0 : 1, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Advisory not found.' });
            createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Vaccine Advisory', 'System', `Updated ${season_label} advisory`);
            res.json({ message: 'Vaccine advisory updated.' });
        }
    );
});

// POST send the active advisory to subscribed staff (CHO only)
app.post('/api/vaccine-advisories/send', authenticate, (req, res) => {
    if (req.user.role !== 'CHO') {
        return res.status(403).json({ error: 'Only CHO can send a vaccine advisory.' });
    }
    currentSeasonAdvisory((err, advisory) => {
        if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
        if (!advisory) return res.status(404).json({ error: 'No active vaccine advisory.' });
        const list = (advisory.vaccine_recommendations || '').split('\n').filter(Boolean).map(x => x.trim()).filter(Boolean);
        const plain = `🌦️ ${advisory.season_label}: ${advisory.title}\n\n${list.map(v => `• ${v}`).join('\n')}\n\n${advisory.message || ''}`;
        db.query(
            `SELECT u.user_id, u.email, u.full_name
             FROM users u
             INNER JOIN notification_preferences np ON u.user_id = np.user_id
             WHERE u.is_active = 1 AND np.vaccine_advisories = 1`,
            (err2, users) => {
                if (err2) return res.status(500).json({ error: 'Something went wrong. Please try again.' });
                let sent = 0;
                users.forEach(user => {
                    db.query(
                        'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                        [user.user_id, `🌦️ ${advisory.title}`, plain, 'vaccine_advisory', null]
                    );
                    if (user.email) {
                        const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px">
                            <h2 style="color:#1e293b;margin:0 0 8px 0">🌦️ ${advisory.title}</h2>
                            <p style="color:#475569;font-size:15px;line-height:1.5">${advisory.season_label}</p>
                            <ul style="color:#0f172a;font-size:15px;line-height:1.7">${list.map(v => `<li>${v}</li>`).join('')}</ul>
                            <p style="color:#64748b;font-size:14px;line-height:1.5">${advisory.message || ''}</p>
                            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
                            <p style="color:#94a3b8;font-size:12px">Cabuyao City Disease Monitoring System</p>
                        </div>`;
                        sendBrevoEmail(user.email, `🌦️ ${advisory.title} - Cabuyao CDMS`, html).catch(() => {});
                    }
                    sent++;
                });
                createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Vaccine Advisory', 'System', `Sent ${advisory.season_label} advisory to ${sent} staff`);
                res.json({ message: `Vaccine advisory sent to ${sent} staff member(s).` });
            }
        );
    });
});

// Monthly cron: auto-send the active advisory to subscribed staff (1st of month, 9AM)
cron.schedule('0 9 1 * *', () => {
    console.log('🌦️ Running seasonal vaccine advisory cron (1st of month 9AM)...');
    currentSeasonAdvisory((err, advisory) => {
        if (err || !advisory) return;
        const list = (advisory.vaccine_recommendations || '').split('\n').filter(Boolean).map(x => x.trim()).filter(Boolean);
        const plain = `🌦️ ${advisory.season_label}: ${advisory.title}\n\n${list.map(v => `• ${v}`).join('\n')}\n\n${advisory.message || ''}`;
        db.query(
            `SELECT u.user_id, u.email FROM users u
             INNER JOIN notification_preferences np ON u.user_id = np.user_id
             WHERE u.is_active = 1 AND np.vaccine_advisories = 1`,
            (err2, users) => {
                if (err2 || !users.length) return;
                users.forEach(user => {
                    db.query(
                        'INSERT INTO notifications (user_id, title, message, type, link_to) VALUES (?, ?, ?, ?, ?)',
                        [user.user_id, `🌦️ ${advisory.title}`, plain, 'vaccine_advisory', null]
                    );
                    if (user.email) {
                        sendBrevoEmail(user.email, `🌦️ ${advisory.title} - Cabuyao CDMS`, plain).catch(() => {});
                    }
                });
                console.log(`🌦️ Vaccine advisory sent to ${users.length} user(s).`);
            }
        );
    });
});

// ==========================================
// 8. SYSTEM MAINTENANCE ENDPOINT
// ==========================================

// POST /api/notifications/system-maintenance - broadcast to all users with preference
app.post('/api/notifications/system-maintenance', authenticate, (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required.' });
    }

    db.query(
        `SELECT u.user_id, u.email, u.mobile_number
         FROM users u
         WHERE u.is_active = 1`,
        (err, users) => {
            if (err) return res.status(500).json({ error: 'Something went wrong. Please try again.' });

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

// POST /api/restore - restore from a backup JSON
app.post('/api/restore', authenticate, (req, res) => {
    if (req.user.role !== 'CHO') {
        return res.status(403).json({ error: 'Only CHO accounts may restore system backups.' });
    }

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
                `INSERT IGNORE INTO users (user_id, username, full_name, role, assigned_barangay_id, is_active, email, mobile_number, last_login, password)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [u.user_id, u.username, u.full_name, u.role, u.assigned_barangay_id, u.is_active, u.email, u.mobile_number, u.last_login, u.password || null],
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
                        createAuditLog(req.user.user_id, req.user.name, req.user.role, null, req.user.barangay || null, 'Restore', 'System Data', `System restored from backup dated ${backup.backup_date}`);
                        console.log(' Restore completed from backup dated ' + backup.backup_date);
                        res.json({ message: 'Restore completed successfully.' });
                    });
                });
            });
        });
    });
});

// POST /api/restore/preview - preview what will be restored before committing
app.post('/api/restore/preview', authenticate, (req, res) => {
    if (req.user.role !== 'CHO') {
        return res.status(403).json({ error: 'Only CHO accounts may preview system restores.' });
    }

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

// Global error handler - masks internal details from clients
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    logAppError('error', 'http', err.message, err.stack);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server failed to start:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
    }
});

// -- Process-level robustness: never die silently; write errors to the error_logs table --
process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
    console.error('Unhandled promise rejection:', msg);
    logAppError('error', 'unhandledRejection', reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : null);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.stack || err.message);
    logAppError('error', 'uncaughtException', err.message, err.stack);
});
process.on('warning', (warning) => {
    if (warning && warning.name === 'MaxListenersExceededWarning') return;
    console.error('Process warning:', warning.message);
    logAppError('warn', 'process-warning', warning.message, warning.stack);
});
