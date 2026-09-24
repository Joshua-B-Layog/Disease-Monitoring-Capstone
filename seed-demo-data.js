const mysql = require('mysql2');
require('dotenv').config();

const DISEASES = [
  { id: 1,  name: 'Tuberculosis', w: 0.04, age: [18, 70], sev: [0.10, 0.35, 0.45, 0.10] },
  { id: 2,  name: 'Typhoid Fever', w: 0.05, age: [10, 45], sev: [0.10, 0.40, 0.40, 0.10] },
  { id: 3,  name: 'Acute Respiratory Infection', w: 0.14, age: [0, 12], sev: [0.20, 0.45, 0.30, 0.05] },
  { id: 4,  name: 'Avian Influenza', w: 0.004, age: [10, 60], sev: [0.00, 0.20, 0.60, 0.20] },
  { id: 5,  name: 'Chickenpox', w: 0.06, age: [2, 14], sev: [0.30, 0.45, 0.20, 0.05] },
  { id: 6,  name: 'Cholera', w: 0.02, age: [5, 60], sev: [0.05, 0.30, 0.50, 0.15] },
  { id: 7,  name: 'Covid-19', w: 0.03, age: [5, 80], sev: [0.30, 0.40, 0.25, 0.05] },
  { id: 8,  name: 'Dengue', w: 0.16, age: [3, 50], sev: [0.10, 0.40, 0.40, 0.10] },
  { id: 9,  name: 'Diphtheria', w: 0.01, age: [1, 15], sev: [0.05, 0.30, 0.50, 0.15] },
  { id: 10, name: 'Ebola', w: 0.002, age: [20, 50], sev: [0.00, 0.10, 0.50, 0.40] },
  { id: 11, name: 'Hand Foot and Mouth Disease', w: 0.05, age: [1, 10], sev: [0.30, 0.45, 0.20, 0.05] },
  { id: 12, name: 'Hepatitis A', w: 0.02, age: [5, 30], sev: [0.20, 0.40, 0.35, 0.05] },
  { id: 13, name: 'Hepatitis B', w: 0.015, age: [20, 50], sev: [0.20, 0.40, 0.35, 0.05] },
  { id: 14, name: 'Hepatitis C', w: 0.015, age: [25, 55], sev: [0.20, 0.40, 0.35, 0.05] },
  { id: 15, name: 'HIV/AIDS', w: 0.01, age: [18, 55], sev: [0.20, 0.40, 0.35, 0.05] },
  { id: 16, name: 'Influenza', w: 0.08, age: [1, 80], sev: [0.25, 0.45, 0.25, 0.05] },
  { id: 17, name: 'Influenza A', w: 0.05, age: [1, 80], sev: [0.25, 0.45, 0.25, 0.05] },
  { id: 18, name: 'Leprosy', w: 0.01, age: [20, 60], sev: [0.20, 0.40, 0.35, 0.05] },
  { id: 19, name: 'Leptospirosis', w: 0.05, age: [15, 60], sev: [0.05, 0.35, 0.45, 0.15] },
  { id: 20, name: 'Malaria', w: 0.01, age: [10, 45], sev: [0.15, 0.40, 0.35, 0.10] },
  { id: 21, name: 'Measles', w: 0.03, age: [1, 10], sev: [0.20, 0.45, 0.30, 0.05] },
  { id: 22, name: 'Meningococcemia', w: 0.01, age: [1, 6], sev: [0.00, 0.15, 0.55, 0.30] },
  { id: 23, name: 'Pertussis', w: 0.02, age: [0, 5], sev: [0.10, 0.45, 0.40, 0.05] },
  { id: 24, name: 'Poliomyelitis', w: 0.005, age: [0, 5], sev: [0.15, 0.40, 0.35, 0.10] },
  { id: 25, name: 'Rabies', w: 0.02, age: [10, 60], sev: [0.00, 0.20, 0.60, 0.20] },
  { id: 26, name: 'SARS', w: 0.002, age: [20, 60], sev: [0.00, 0.15, 0.55, 0.30] },
  { id: 27, name: 'Sore Eyes', w: 0.05, age: [5, 40], sev: [0.50, 0.35, 0.10, 0.05] },
  { id: 28, name: 'Diarrhea', w: 0.10, age: [0, 50], sev: [0.25, 0.45, 0.25, 0.05] },
];

const BARANGAYS = [
  { id: 1, name: 'Baclaran', lat: 14.269, lng: 121.104, w: 0.07 },
  { id: 2, name: 'Banay-Banay', lat: 14.338, lng: 121.121, w: 0.045 },
  { id: 3, name: 'Banlic', lat: 14.342, lng: 121.126, w: 0.05 },
  { id: 4, name: 'Barangay Uno (Poblacion)', lat: 14.284, lng: 121.126, w: 0.08 },
  { id: 5, name: 'Barangay Dos (Poblacion)', lat: 14.283, lng: 121.122, w: 0.085 },
  { id: 6, name: 'Barangay Tres (Poblacion)', lat: 14.282, lng: 121.119, w: 0.08 },
  { id: 7, name: 'Bigaa', lat: 14.249, lng: 121.116, w: 0.06 },
  { id: 8, name: 'Butong', lat: 14.222, lng: 121.109, w: 0.04 },
  { id: 9, name: 'Casile', lat: 14.202, lng: 121.098, w: 0.03 },
  { id: 10, name: 'Diezmo', lat: 14.320, lng: 121.108, w: 0.045 },
  { id: 11, name: 'Gulod', lat: 14.244, lng: 121.104, w: 0.06 },
  { id: 12, name: 'Mamatid', lat: 14.325, lng: 121.132, w: 0.09 },
  { id: 13, name: 'Marinig', lat: 14.263, lng: 121.128, w: 0.08 },
  { id: 14, name: 'Niugan', lat: 14.234, lng: 121.121, w: 0.07 },
  { id: 15, name: 'Pittland', lat: 14.231, lng: 121.126, w: 0.03 },
  { id: 16, name: 'Pulo', lat: 14.320, lng: 121.115, w: 0.07 },
  { id: 17, name: 'Sala', lat: 14.281, lng: 121.110, w: 0.06 },
  { id: 18, name: 'San Isidro', lat: 14.302, lng: 121.113, w: 0.06 },
];

const MONTH_WEIGHTS = {
  dengue:      [0.4, 0.5, 0.6, 0.7, 0.8, 1.2, 1.8, 2.0, 1.6, 0.9, 0.6, 0.4],
  lepto:       [0.5, 0.5, 0.6, 0.7, 0.8, 1.0, 1.4, 2.0, 1.8, 1.2, 0.8, 0.6],
  respiratory: [1.2, 1.0, 0.8, 0.7, 0.6, 0.9, 1.2, 1.4, 1.3, 1.0, 1.2, 1.5],
  cholera:     [1.2, 1.3, 1.3, 1.2, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.1, 1.1],
  children:    [1.3, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2],
};

const FIRST_M = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Liza', 'Carlos', 'Rosa', 'Miguel', 'Elena', 'Ramon', 'Gloria', 'Andres', 'Carmen', 'Ben', 'Teresa', 'Rico', 'Joy', 'Dennis', 'Maricel', 'Paolo', 'Aiza', 'Mark', 'Jasmine', 'Ryan', 'Kathleen', 'Erwin', 'Grace', 'Alvin', 'Fatima', 'Rodel', 'Divina', 'Noli', 'Cristina', 'Jerome', 'Myla', 'Ferdinand', 'Sheryl', 'Edwin', 'Rowena'];
const FIRST_W = ['Maria', 'Ana', 'Liza', 'Rosa', 'Elena', 'Gloria', 'Carmen', 'Teresa', 'Joy', 'Maricel', 'Aiza', 'Jasmine', 'Kathleen', 'Grace', 'Fatima', 'Divina', 'Cristina', 'Myla', 'Sheryl', 'Rowena'];
const LAST = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Torres', 'Ramos', 'Flores', 'Villanueva', 'Aquino', 'Bautista', 'Castillo', 'Domingo', 'Fernandez', 'Gonzales', 'Lopez', 'Martinez', 'Navarro', 'Pascual', 'Rivera', 'Sanchez', 'Valdez', 'Silva', 'Cruz', 'Dizon', 'Manalo', 'De Guzman', 'Salazar', 'Lazaro', 'Ocampo', 'Villarin', 'Buenaventura', 'Cortez', 'Enriquez', 'Ferrer', 'Javier', 'Luna', 'Marquez', 'Nolasco', 'Padilla'];

const SYMPTOMS = {
  1: ['Cough', 'Fever', 'Night sweats', 'Weight loss'],
  2: ['Prolonged fever', 'Headache', 'Abdominal pain', 'Weakness'],
  3: ['Cough', 'Cold', 'Fever', 'Difficulty breathing'],
  4: ['Fever', 'Cough', 'Sore throat', 'Muscle aches'],
  5: ['Rash', 'Itching', 'Fever', 'Fatigue'],
  6: ['Diarrhea', 'Vomiting', 'Dehydration', 'Muscle cramps'],
  7: ['Fever', 'Cough', 'Loss of taste', 'Shortness of breath'],
  8: ['High fever', 'Headache', 'Joint pain', 'Skin rash'],
  9: ['Sore throat', 'Fever', 'Swollen tonsils', 'Weakness'],
  10: ['High fever', 'Headache', 'Vomiting', 'Bleeding'],
  11: ['Fever', 'Mouth sores', 'Hand rash', 'Foot rash'],
  12: ['Jaundice', 'Fever', 'Fatigue', 'Nausea'],
  13: ['Jaundice', 'Abdominal pain', 'Dark urine', 'Fatigue'],
  14: ['Fatigue', 'Jaundice', 'Muscle pain', 'Nausea'],
  15: ['Weight loss', 'Recurrent fever', 'Swollen nodes', 'Fatigue'],
  16: ['Fever', 'Body ache', 'Headache', 'Cough'],
  17: ['High fever', 'Cough', 'Sore throat', 'Body ache'],
  18: ['Skin lesions', 'Numbness', 'Weakness', 'Loss of sensation'],
  19: ['Fever', 'Muscle pain', 'Red eyes', 'Jaundice'],
  20: ['Fever', 'Chills', 'Headache', 'Nausea'],
  21: ['Rash', 'Fever', 'Cough', 'Red eyes'],
  22: ['High fever', 'Stiff neck', 'Rash', 'Vomiting'],
  23: ['Severe cough', 'Coughing fits', 'Cyanosis', 'Vomiting'],
  24: ['Fever', 'Sore throat', 'Muscle stiffness', 'Paralysis'],
  25: ['Fever', 'Anxiety', 'Hydrophobia', 'Difficulty swallowing'],
  26: ['Fever', 'Cough', 'Difficulty breathing', 'Chills'],
  27: ['Eye redness', 'Itching', 'Discharge', 'Swollen eyelids'],
  28: ['Diarrhea', 'Vomiting', 'Stomach pain', 'Dehydration'],
};

const CASE_TYPES = ['Confirmed', 'Probable', 'Suspected'];
const CASE_TYPES_W = [0.60, 0.25, 0.15];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(rnd, items, weightKey) {
  let total = 0;
  for (const it of items) total += it[weightKey];
  let r = rnd() * total;
  for (const it of items) { r -= it[weightKey]; if (r <= 0) return it; }
  return items[items.length - 1];
}

function pickByWeights(rnd, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

function monthProfile(diseaseName) {
  const n = diseaseName.toLowerCase();
  if (n === 'dengue') return MONTH_WEIGHTS.dengue;
  if (n.includes('leptospirosis')) return MONTH_WEIGHTS.lepto;
  if (n.includes('respiratory') || n.includes('influenza')) return MONTH_WEIGHTS.respiratory;
  if (n === 'cholera') return MONTH_WEIGHTS.cholera;
  if (['chickenpox', 'hand foot and mouth disease', 'measles', 'pertussis', 'meningococcemia', 'poliomyelitis', 'diphtheria'].includes(diseaseName)) return MONTH_WEIGHTS.children;
  return Array(12).fill(1);
}

function pad(n) { return String(n).padStart(2, '0'); }

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : null;
}
const hasFlag = (name) => args.includes(name);

const years = parseInt(flag('--years') || '5', 10);
const countFlag = flag('--count');
const perYear = parseInt(flag('--per-year') || (countFlag ? String(Math.round(parseInt(countFlag, 10) / years)) : '1000'), 10);
const total = countFlag ? parseInt(countFlag, 10) : (perYear >= years ? perYear * years : 500 * years);
const endArg = flag('--end');
const nowRef = endArg ? new Date(endArg + 'T00:00:00') : new Date();
const dbUrl = flag('--db-url');
const doClear = hasFlag('--clear');
const dryRun = hasFlag('--dry-run');
const noHistory = hasFlag('--no-history');
const seed = hasFlag('--seed') ? parseInt(flag('--seed'), 10) : 20240901;

const YEAR_WEIGHTS = Array.from({ length: years }, (_, i) => 1 + i * 0.04);

function buildConfig() {
  if (dbUrl) {
    const u = new URL(dbUrl);
    return {
      host: u.hostname,
      port: u.port || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }
  const env = process.env;
  if (env.DB_HOST) {
    return { host: env.DB_HOST, port: env.DB_PORT || 3306, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME };
  }
  return {
    host: env.MYSQLHOST, port: env.MYSQLPORT || 3306, user: env.MYSQLUSER, password: env.MYSQLPASSWORD, database: env.MYSQLDATABASE,
  };
}

function printHelp() {
  console.log('CDMS Demo Data Seeder');
  console.log('');
  console.log('Usage: node seed-demo-data.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --count <n>        Total cases to generate (e.g. --count 2600)');
  console.log('  --per-year <n>     Cases per year (default 1000)');
  console.log('  --years <n>        Number of years (default 5)');
  console.log('  --end <YYYY-MM-DD> End date of the window (default today)');
  console.log('  --db-url <dsn>     MySQL connection string, e.g. mysql://user:pass@host:3306/db');
  console.log('  --clear            Delete previously seeded rows (physician = "System Seeder")');
  console.log('  --dry-run          Print the plan and exit without touching the database');
  console.log('  --no-history       Do not write case_status_history rows');
  console.log('  --help             Show this help');
}

function main() {
  if (hasFlag('--help')) { printHelp(); return; }

  const rnd = mulberry32(seed);
  const rnd2 = mulberry32(seed + 1);
  const yearLookup = [];
  for (let i = 0; i < years; i++) yearLookup.push({ idx: i, w: YEAR_WEIGHTS[i] });

  const planByYear = {};
  const planByDisease = {};

  const rows = [];
  for (let n = 0; n < total; n++) {
    const disease = weightedPick(rnd, DISEASES, 'w');
    const barangay = weightedPick(rnd, BARANGAYS, 'w');
    const yearPick = weightedPick(rnd, yearLookup, 'w');
    const yearIdx = yearPick.idx;
    const year = nowRef.getFullYear() - (years - 1) + yearIdx;
    const monthWeights = monthProfile(disease.name);
    const month = pickByWeights(rnd, monthWeights) + 1;
    const day = 1 + Math.floor(rnd() * 28);
    const hour = 8 + Math.floor(rnd() * 10);
    const minute = Math.floor(rnd() * 60);
    const report = new Date(year, month - 1, day, hour, minute, Math.floor(rnd() * 60));
    if (report > nowRef) report.setTime(nowRef.getTime());

    const ageMin = disease.age[0], ageMax = disease.age[1];
    const age = ageMin + Math.floor(Math.abs((rnd() * 2 - 0.15)) * (ageMax - ageMin + 1)) % (ageMax - ageMin + 1);
    const female = rnd() < 0.48;
    const first = female ? FIRST_W[Math.floor(rnd() * FIRST_W.length)] : FIRST_M[Math.floor(rnd() * FIRST_M.length)];
    const last = LAST[Math.floor(rnd() * LAST.length)];
    const sevIdx = pickByWeights(rnd, disease.sev);
    const severity = ['Asymptomatic', 'Mild', 'Moderate', 'Severe'][sevIdx];
    const caseType = CASE_TYPES[pickByWeights(rnd, CASE_TYPES_W)];

    const daysAgo = Math.max(0, Math.floor((nowRef - report) / 86400000));
    let status;
    const chronic = disease.id === 1 || disease.id === 15;
    if (daysAgo <= 90) {
      const s = rnd();
      status = s < 0.50 ? 'Active' : s < 0.75 ? 'Under Treatment' : s < 0.85 ? 'Pending' : s < 0.98 ? 'Recovered' : 'Deceased';
    } else {
      const s = rnd();
      if (chronic && s < 0.05) { status = 'Under Treatment'; }
      else status = s < 0.93 ? 'Recovered' : s < 0.97 ? 'Deceased' : 'Recovered';
    }

    const symptomsList = SYMPTOMS[disease.id] || ['Fever'];
    const symptoms = symptomsList.filter(() => rnd() < 0.7).join(', ') || symptomsList[0];

    rows.push({
      patient_name: `${first} ${last}`,
      disease_id: disease.id,
      age,
      severity,
      case_type: caseType,
      disease_type: null,
      gender: female ? 'Female' : 'Male',
      status,
      contact: '09' + String(Math.floor(rnd2() * 100000000)).padStart(9, '0'),
      onset_date: (() => { const d = new Date(report); d.setDate(d.getDate() - Math.floor(rnd() * 7)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })(),
      address: `Brgy. ${barangay.name}, Cabuyao City, Laguna`,
      barangay_id: barangay.id,
      symptoms,
      physician: 'System Seeder',
      latitude: +(barangay.lat + (rnd() - 0.5) * 0.012).toFixed(6),
      longitude: +(barangay.lng + (rnd() - 0.5) * 0.012).toFixed(6),
      date_reported: report,
      created_by: null,
      _daysAgo: daysAgo,
    });

    const yr = report.getFullYear();
    planByYear[yr] = (planByYear[yr] || 0) + 1;
    planByDisease[disease.name] = (planByDisease[disease.name] || 0) + 1;
  }

  console.log('=== CDMS Demo Seed Plan ===');
  console.log(`Window: ${nowRef.getFullYear() - (years - 1)}-01-01 .. ${nowRef.getFullYear()}-${pad(nowRef.getMonth() + 1)}-${pad(nowRef.getDate())}`);
  console.log(`Total cases: ${total}`);
  console.log('');
  console.log('--- By year ---');
  Object.keys(planByYear).sort().forEach((yr) => console.log(`  ${yr}: ${planByYear[yr]}`));
  console.log('');
  console.log('--- Top diseases ---');
  Object.entries(planByDisease).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([d, c]) => console.log(`  ${d}: ${c}`));

  if (dryRun) {
    console.log('');
    console.log('Dry run only - nothing written.');
    return;
  }

  const config = buildConfig();
  if (!config.host || !config.user || !config.database) {
    console.error('Could not determine database connection. Set DB_* in .env or pass --db-url.');
    process.exit(1);
  }
  console.log('');
  console.log(`Connecting to MySQL at ${config.host}:${config.port} db=${config.database}`);

  const conn = mysql.createConnection(config);
  conn.connect((err) => {
    if (err) { console.error('MySQL connection failed:', err.message); process.exit(1); }

    const run = (sql, params) => new Promise((resolve, reject) => conn.query(sql, params, (e, r) => e ? reject(e) : resolve(r)));

    (async () => {
      if (doClear) {
        await run('DELETE FROM case_status_history WHERE changed_by_name = ?', ['System Seeder']);
        const del = await run('DELETE FROM disease_cases WHERE physician = ?', ['System Seeder']);
        console.log(`Cleared ${del.affectedRows} seeded case(s).`);
        if (!hasFlag('--count') && !dryRun) { conn.end(); return; }
      }

      const BATCH = 250;
      const cols = 'patient_name, disease_id, age, severity, case_type, disease_type, gender, status, contact, onset_date, address, barangay_id, symptoms, physician, latitude, longitude, date_reported, created_by';
      let inserted = 0;
      let histories = 0;
      const idMap = [];

      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const vals = [];
        for (const r of slice) {
          vals.push(r.patient_name, r.disease_id, r.age, r.severity, r.case_type, r.disease_type, r.gender, r.status,
            r.contact, r.onset_date, r.address, r.barangay_id, r.symptoms, r.physician, r.latitude, r.longitude, r.date_reported, r.created_by);
        }
        const result = await run(`INSERT INTO disease_cases (${cols}) VALUES ${placeholders}`, vals);
        for (let j = 0; j < slice.length; j++) idMap.push({ id: result.insertId + j, row: slice[j] });
        inserted += slice.length;
      }

      if (!noHistory) {
        const histRows = [];
        for (const { id, row } of idMap) {
          if (row._daysAgo > 90 && (row.status === 'Recovered' || row.status === 'Deceased')) {
            const mid = new Date(row.date_reported);
            mid.setDate(mid.getDate() + 3 + Math.floor(rnd() * 8));
            const fin = new Date(mid);
            fin.setDate(fin.getDate() + 10 + Math.floor(rnd() * 40));
            histRows.push([id, 'Active', 'Under Treatment', null, 'System Seeder', 'System', null, mid]);
            histRows.push([id, 'Under Treatment', row.status, null, 'System Seeder', 'System', null, fin]);
          }
        }
        for (let i = 0; i < histRows.length; i += BATCH) {
          const slice = histRows.slice(i, i + BATCH);
          const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const vals = [];
          for (const h of slice) vals.push(...h);
          await run(`INSERT INTO case_status_history (case_id, old_status, new_status, changed_by, changed_by_name, changed_by_role, notes, changed_at) VALUES ${placeholders}`, vals);
          histories += slice.length;
        }
      }

      console.log('');
      console.log('=== Seed Complete ===');
      console.log(`Cases inserted: ${inserted}`);
      if (!noHistory) console.log(`Status-history rows: ${histories}`);
      console.log(`Marker: physician = "System Seeder" (use --clear to remove)`);
      conn.end();
    })().catch((e) => {
      console.error('Seeding failed:', e.message);
      conn.end();
      process.exit(1);
    });
  });
}

main();