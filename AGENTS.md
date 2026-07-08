# Disease Monitoring Capstone - AI Instructions

## Project Overview
This is a Web-Based Disease Monitoring and Mapping System for the City of Cabuyao, Laguna, Philippines. Built for the City Health Office (CHO) and Barangay Health Workers (BHW).

## Tech Stack
- Backend: Node.js + Express.js + MySQL (mysql2)
- Frontend: React + Vite
- Maps: React Leaflet + OpenStreetMap
- Email: Nodemailer (Gmail)
- SMS: Brevo Transactional SMS API

## Project Structure
- `server.js` — main backend, all API routes
- `frontend/src/App.jsx` — main app controller
- `frontend/src/Dashboard.jsx` — dashboard with stats and charts
- `frontend/src/ManageCases.jsx` — disease case CRUD
- `frontend/src/MapView.jsx` — interactive disease map
- `frontend/src/UserManagement.jsx` — user account management
- `frontend/src/BarangayReports.jsx` — audit logs and reports
- `frontend/src/ChoSettings.jsx` — profile and settings
- `frontend/src/components/Login.jsx` — full login/signup/recovery flow

## Database: cabuyao_cdms_db
Tables: users, barangays, diseases, disease_cases

## User Roles
- CHO (City Health Office) — admin, full access
- BHW (Barangay Health Worker) — field worker, limited access

## 18 Barangays of Cabuyao
Baclaran, Banay-Banay, Banlic, Barangay Dos (Poblacion),
Barangay Tres (Poblacion), Barangay Uno (Poblacion), Bigaa,
Butong, Casile, Diezmo, Gulod, Mamatid, Marinig, Niugan,
Pitland, Pulo, Sala, San Isidro

## 28 Communicable Diseases Tracked
Acute Respiratory Infection, Avian Influenza, Chickenpox, Cholera, Covid-19, Dengue,
Diarrhea, Diphtheria, Ebola, Hand Foot and Mouth Disease, Hepatitis A, Hepatitis B,
Hepatitis C, HIV/AIDS, Influenza, Influenza A, Leprosy,
Leptospirosis, Malaria, Measles, Meningococcemia, Pertussis, Poliomyelitis, Rabies,
SARS, Sore Eyes, Tuberculosis, Typhoid Fever

## Important Rules When Editing
- Never hardcode colors — always use CSS variables for themed components
- Status values: Active, Pending, Under Treatment, Recovered, Deceased, Draft
- All API calls go to http://localhost:5000
- Frontend runs on http://localhost:3000
- Always preserve existing working features when adding new ones
- MySQL passwords are stored as plain text (no hashing yet)
- The .env file holds DB credentials and email/SMS keys
- Brevo SMS setup: 1) Ensure BREVO_API_KEY is set in .env (same key as email), 2) SMS sender name is 'Cabuyao', 3) Phone numbers are automatically formatted to international format (+63...) by formatPhone()