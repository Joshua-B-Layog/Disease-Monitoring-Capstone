# Cabuyao Disease Monitoring and Mapping System (CDMS)

A web-based disease surveillance and mapping system built for the **City Health Office (CHO) and Barangay Health Workers (BHW)** of Cabuyao, Laguna, Philippines. The system enables real-time tracking, mapping, and reporting of 28 communicable diseases across 18 barangays.

## Features

### CHO (City Health Officer)
- **Dashboard** - Real-time stats with trend comparisons, interactive bar charts, and export options (Word, Excel, CSV, PDF, PowerPoint)
- **Manage Cases** - Full CRUD for disease cases with auto-geocoding, patient auto-fill, and status tracking
- **Map View** - Interactive Leaflet map with barangay boundaries, satellite (Esri)/street (OSM) tiles, pin markers, case clustering, and per-user scoping to your CHO Unit / barangay
- **Audit Reports** - System-generated logs with Excel/PDF export and filtered search
- **User Accounts** - Manage BHW accounts, approve/reject registrations
- **Inbox** - Notifications, referrals, edit requests, and registration approvals
- **Settings** - Profile, password, 2FA, notifications, appearance, language, timezone, data management

### BHW (Barangay Health Worker)
- **Dashboard** - Scoped to assigned barangay with "Top Disease" view
- **Manage Cases** - Add new cases, request edits via CHO
- **Map View** - View-only map locked to the user's barangay (OSM street / Esri satellite)
- **Settings** - Profile and password management

### Resident Portal
- **Prevention Tips** - 28 disease cards with prevention tips, YouTube videos, and symptom checker quiz
- **Interactive Map** - Public disease map with barangay risk classification and health overview
- **Contact Us** - Submit health concerns to BHW inbox

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js |
| Database | MySQL (mysql2) |
| Frontend | React 18 + Vite |
| Maps | React Leaflet — Esri World Imagery satellite (HD) + OSM street (SD) |
| Email | Brevo Transactional Email API |
| SMS | Brevo Transactional SMS API |
| PWA | Workbox + vite-plugin-pwa |

## System Requirements

- **Node.js** v18+
- **MySQL** v8+
- **npm** v9+

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Install dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 3. Configure environment variables
The backend reads its configuration from **`.env.local`** (see `server.js`). Copy the template and fill in real values:
```bash
cp .env.example .env.local
```
```env
# Example — see `.env.example`
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cabuyao_cdms_db

# Brevo Transactional Email API (OTP, recovery, approvals, weekly summaries)
BREVO_FROM=your_verified_sender@example.com
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxx
```
> Note: the `BREVO_FROM` sender must be verified in the Brevo dashboard (Account → Senders). No Gmail/Gmail SMTP is used — email is sent via the Brevo Transactional Email API with `BREVO_API_KEY` only.

### 4. Set up the database
Import the `cabuyao_cdms_db` schema into your MySQL server.

### 5. Start the servers
```bash
# Backend (port 5000)
node server.js

# Frontend (port 3000) — in a separate terminal
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── server.js                  # Backend API server
├── package.json               # Backend dependencies
├── .env.local                  # Environment variables (not committed; copy from .env.example)
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app controller
│   │   ├── Dashboard.jsx      # Dashboard with stats and charts
│   │   ├── ManageCases.jsx    # Disease case CRUD
│   │   ├── MapView.jsx        # Interactive disease map
│   │   ├── UserManagement.jsx # User account management
│   │   ├── BarangayReports.jsx# Audit logs and reports
│   │   ├── WeeklySummary.jsx  # Weekly disease summary report
│   │   ├── ChoSettings.jsx    # Profile and settings
│   │   ├── WeeklySummary.jsx  # Weekly disease summary report
│   │   ├── ResidentApp.jsx    # Resident portal (public)
│   │   ├── diseaseSignal.js   # Cross-tab live-update signaling
│   │   ├── syncEngine.js      # Offline sync queue
│   │   ├── offlineSync.js     # IndexedDB cache helpers
│   │   ├── config.js          # API URL config
│   │   ├── components/
│   │   │   ├── Login.jsx      # Login/signup/recovery flow
│   │   │   ├── BackButton.jsx # Reusable back navigation
│   │   │   ├── RecoverAccount.jsx # Password recovery
│   │   │   └── Sidebar.jsx    # Navigation sidebar
│   │   └── resident/
│   │       ├── PreventionTips.jsx # Disease prevention cards
│   │       ├── ResidentMap.jsx    # Public disease map
│   │       ├── ContactUs.jsx      # Resident contact form
│   │       ├── AboutCho.jsx       # About the City Health Office
│   │       └── Help.jsx           # Help/support page
│   ├── public/
│   │   ├── favicon.svg        # CHO 1 logo favicon
│   │   └── icons/             # PWA icons (192x192, 512x512)
│   └── vite.config.js         # Vite + PWA config
```

## Database

**Database name:** `cabuyao_cdms_db`

| Table | Description |
|-------|-------------|
| `users` | CHO and BHW accounts |
| `barangays` | 18 barangays of Cabuyao |
| `diseases` | 28 tracked communicable diseases |
| `disease_cases` | Patient case records |
| `notifications` | System notifications |
| `notification_preferences` | User notification settings |
| `case_edit_requests` | BHW-to-CHO edit requests |

## 18 Barangays of Cabuyao

Baclaran, Banay-Banay, Banlic, Barangay Dos (Poblacion), Barangay Tres (Poblacion), Barangay Uno (Poblacion), Bigaa, Butong, Casile, Diezmo, Gulod, Mamatid, Marinig, Niugan, Pittland, Pulo, Sala, San Isidro

## 28 Communicable Diseases Tracked

Acute Respiratory Infection, Avian Influenza, Chickenpox, Cholera, Covid-19, Dengue, Diarrhea, Diphtheria, Ebola, Hand Foot and Mouth Disease, Hepatitis A, Hepatitis B, Hepatitis C, HIV/AIDS, Influenza, Influenza A, Leprosy, Leptospirosis, Malaria, Measles, Meningococcemia, Pertussis, Poliomyelitis, Rabies, SARS, Sore Eyes, Tuberculosis, Typhoid Fever

## PWA & Offline Support

- Service worker with Workbox for static asset precaching
- API responses cached with runtime strategies (NetworkFirst, StaleWhileRevalidate)
- OpenStreetMap tiles cached for 30 days
- IndexedDB (Dexie.js) for offline case data, audit logs, and sync queue
- Automatic sync on reconnect with conflict detection

## Deployment

| Piece | Host | Details |
|-------|------|---------|
| Frontend | **Vercel** | Root directory `frontend`; env var `VITE_API_URL` points to the Railway backend |
| Backend + MySQL | **Railway** | `https://disease-monitoring-capstone-production.up.railway.app`; secrets set in the Railway dashboard (DB\_\*/MYSQL\*, FRONTEND_URL, BREVO\_\*) |

Deployment is automatic: pushing to the `main` branch triggers both platforms to redeploy.

## Troubleshooting: Brevo "Verify a new IP" email

Brevo sends a "Verify a new IP" / "authorize this new IP address" email to the account owner whenever the `BREVO_API_KEY` is used from a network/IP it hasn't seen before (e.g. running the backend on a new laptop, or a Railway redeploy where the egress IP rotates). This is a **Brevo account-security notice, not a Gmail login prompt**.

To stop these notices permanently: Brevo dashboard → **Organization Settings → Authorized IPs → API keys** → disable/unblock unauthorized IP addresses. After that, any IP may use the API key with no verification email.

## License

This project was developed as a capstone project for educational purposes.
