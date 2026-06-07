// 1. IMPORT REQUIRED PACKAGES
require('dotenv').config(); // THIS is the magic line that reads your .env file!
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// 2. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 3. DATABASE CONNECTION (Using your .env variables safely)
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

// ROUTE: Get list of Diseases (For your Add Case dropdowns)
app.get('/api/diseases', (req, res) => {
    const sql = "SELECT * FROM diseases";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ROUTE: Get list of Barangays (For your Add Case dropdowns)
app.get('/api/barangays', (req, res) => {
    const sql = "SELECT * FROM barangays";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/users', (req, res) => {
    const sql = "SELECT * FROM users";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// Inside your backend server.js
app.get('/api/reports', (req, res) => {
  db.query("SELECT * FROM barangay_reports", (err, results) => {
    if (err) res.status(500).send(err);
    else res.json(results);
  });
});


app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  // DEBUG: This will print the values to your terminal
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

    // DEBUG: Show how many matches were found
    console.log("Results found:", results.length);
    if (results.length === 0) {
        console.log("No user matched these credentials.");
    }

    if (results.length > 0) {
      // ... (your success code)
      const user = results[0];
      return res.status(200).json({ message: 'Success', user: { id: user.user_id, name: user.full_name, role: user.role } });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// ==========================================
// 5. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});