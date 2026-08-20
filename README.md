# Cabuyao Disease Monitoring and Mapping System (CDMS)

A web-based disease surveillance and mapping system built for the **City Health Office (CHO) and Barangay Health Workers (BHW)** of Cabuyao, Laguna, Philippines. The system enables real-time tracking, mapping, and reporting of 28 communicable diseases across 18 barangays.

## Features

### CHO (City Health Officer)
- **Dashboard** - Real-time stats with trend comparisons, interactive bar charts, and export options (Word, Excel, CSV, PDF, PowerPoint)
- **Manage Cases** - Full CRUD for disease cases with auto-geocoding, patient auto-fill, and status tracking
- **Map View** - Interactive Leaflet map with barangay boundaries, satellite/standard tiles, pin markers, and case clustering
- **Audit Reports** - System-generated logs with Excel/PDF export and filtered search
- **User Accounts** - Manage BHW accounts, approve/reject registrations
- **Inbox** - Notifications, referrals, edit requests, and registration approvals
- **Settings** - Profile, password, 2FA, notifications, appearance, language, timezone, data management

### BHW (Barangay Health Worker)
- **Dashboard** - Scoped to assigned barangay with "Top Disease" view
- **Manage Cases** - Add new cases, request edits via CHO
- **Map View** - View-only map of assigned barangay
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
| Maps | React Leaflet + OpenStreetMap |
| Email | Nodemailer (Gmail SMTP) |
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
Create a `.env` file in the project root:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cabuyao_cdms_db

EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

BREVO_API_KEY=your_brevo_api_key
```

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
├── .env                       # Environment variables (not committed)
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
│   │   ├── syncEngine.js      # Offline sync queue
│   │   ├── offlineSync.js     # IndexedDB cache helpers
│   │   ├── config.js          # API URL config
│   │   ├── components/
│   │   │   ├── Login.jsx      # Login/signup/recovery flow
│   │   │   ├── BackButton.jsx # Reusable back navigation
│   │   │   └── Sidebar.jsx    # Navigation sidebar
│   │   └── resident/
│   │       ├── PreventionTips.jsx # Disease prevention cards
│   │       ├── ResidentMap.jsx    # Public disease map
│   │       └── ContactUs.jsx      # Resident contact form
│   ├── public/
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

Baclaran, Banay-Banay, Banlic, Barangay Dos (Poblacion), Barangay Tres (Poblacion), Barangay Uno (Poblacion), Bigaa, Butong, Casile, Diezmo, Gulod, Mamatid, Marinig, Niugan, Pitland, Pulo, Sala, San Isidro

## 28 Communicable Diseases Tracked

Acute Respiratory Infection, Avian Influenza, Chickenpox, Cholera, Covid-19, Dengue, Diarrhea, Diphtheria, Ebola, Hand Foot and Mouth Disease, Hepatitis A, Hepatitis B, Hepatitis C, HIV/AIDS, Influenza, Influenza A, Leprosy, Leptospirosis, Malaria, Measles, Meningococcemia, Pertussis, Poliomyelitis, Rabies, SARS, Sore Eyes, Tuberculosis, Typhoid Fever

## PWA & Offline Support

- Service worker with Workbox for static asset precaching
- API responses cached with runtime strategies (NetworkFirst, StaleWhileRevalidate)
- OpenStreetMap tiles cached for 30 days
- IndexedDB (Dexie.js) for offline case data, audit logs, and sync queue
- Automatic sync on reconnect with conflict detection

## License

This project was developed as a capstone project for educational purposes.
