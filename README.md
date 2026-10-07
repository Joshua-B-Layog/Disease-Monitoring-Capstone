# Cabuyao Disease Monitoring and Mapping System (CDMS)

A web-based disease surveillance and mapping system built for the **City Health Office (CHO) and Barangay Health Workers (BHW)** of Cabuyao, Laguna, Philippines. It enables real-time tracking, mapping, and reporting of **28 communicable diseases** across **18 barangays**, with offline support, an approval workflow for field workers, and live weather-hazard alerts.

---

## Quick Start — Docker (recommended)

The fastest way to get a full working instance on a new machine. Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone <your-repo-url>
cd <repo-folder>
docker compose up --build
```

Wait for the first build (one-off), then open **[http://localhost:3000](http://localhost:3000)**.

That's it — MySQL is seeded automatically, the backend self-migrates the rest of the schema, and Vite serves the frontend with hot reload.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| MySQL (external tool) | `localhost:3307` — user `root`, password `cho_cabuyao` |

### Seeded logins

`init.sql` loads sample data on the **first** start so you can log in immediately:

| Username | Password | Role | Scope to pick on the login screen |
|----------|----------|------|-----------------------------------|
| `cho_niugan` | `test123` | CHO | **CHO Unit II (Pulo)** (account is assigned to Pittland) |
| `bhw_mamatid` | `password123` | BHW | **Brgy. Marinig** |

> The login rejects the wrong scope on purpose — CHO accounts only get the unit that owns their assigned barangay, BHWs only get their own barangay. Pick the scope shown above.

> Email/SMS are **optional**. Without Brevo credentials the app runs normally and simply skips sending. To switch them on, copy `.env.example` to `.env` and fill in your Brevo key — Compose picks it up automatically.

### Useful commands

```bash
docker compose logs -f backend   # watch API + cron output
docker compose down              # stop (data persists in the mysql_data volume)
docker compose down -v           # stop AND wipe the database (re-runs init.sql)
docker compose up --build        # rebuild after changing package.json
```

### Reset the database

The seed only runs on a brand-new volume:

```bash
docker compose down -v && docker compose up --build
```

---

## Hand-off — Running It on Another Laptop

Everything needed to run the system is **inside this folder**. Containers and images are *not* stored here — they are built fresh on each machine, so handing the folder to someone else produces a brand-new working stack.

### What transfers

| Transfers | Does not transfer (and doesn't need to) |
|-----------|-----------------------------------------|
| `docker-compose.yml`, `Dockerfile`, `frontend/Dockerfile` | Your running containers |
| `.dockerignore`, `frontend/.dockerignore` | Built images (they rebuild on the target machine) |
| `package.json` + `package-lock.json` (both), `init.sql` | Your database data |
| All source code (`server.js`, `frontend/src`, …) | `.env`, `backups/` (git-ignored on purpose) |
| `README.md` | `AGENTS.md`, `CAPSTONE_REFERENCE.md` (local-only) |

### Requirements on the receiving machine

- **Docker Desktop** installed with the WSL2 backend enabled
- **Internet on first run only** — to pull `node:20-alpine` and `mysql:8.0` (a few hundred MB) and run `npm ci`

No Node, no MySQL, and no `.env` file are needed. Docker Compose injects `DB_HOST=db` and the other defaults itself, and `init.sql` seeds the four core tables (plus demo logins) automatically on first start.

### The whole procedure

```bash
# Option A — via git (Docker files are NOT git-ignored, so they come along)
git clone <repo-url> cdms
cd cdms

# Option B — hand over a copy of the folder instead
cd "C:\capstone"          # a normal local path, not OneDrive

# both options finish here
docker compose up --build
# frontend → http://localhost:3000
# backend  → http://localhost:5000/api/ping
```

Second and later runs are fast (Docker layer cache); a rebuild after editing `package.json` takes a few seconds, not minutes.

### Fully offline transfer (skip the image downloads)

If the target machine has no internet, ship the built images with you:

```bash
# on your machine
docker save diseasemonitoringcapstone-frontend \
            diseasemonitoringcapstone-backend \
            -o cdms-images.tar

# on the target machine (needs mysql:8.0 too)
docker load -i cdms-images.tar
docker compose up -d          # no --build needed
```

> The `mysql:8.0` base image is separate — `docker save` it as well, or run `docker pull mysql:8.0` once somewhere with internet.

### Caveats

- **Do not run it from a OneDrive-synced folder.** Docker bind-mounts are slow there, and OneDrive "Files On-Demand" can expose 0-byte placeholders into the containers. Use a normal local path (e.g. `C:\capstone`).
- **Ports 3000 and 5000 must be free.** The frontend dev server uses `strictPort: true`, so it fails loudly instead of drifting to 3001.
- **Each machine starts with an empty database.** `init.sql` seeds demo logins, so the app is usable immediately, but production data must be restored separately (`POST /api/restore` with a backup file).
- **No Brevo keys? Still works.** Email/SMS and 2FA are skipped gracefully; add `.env` only when you want them on.

---

## Quick Start — Manual

For local development without containers.

### 1. Clone and install
```bash
git clone <your-repo-url>
cd <repo-folder>

npm install            # backend
cd frontend && npm install && cd ..
```

### 2. Configure environment
The backend reads **`.env.local`** (hardcoded in `server.js`):
```bash
cp .env.example .env.local
```
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cabuyao_cdms_db

BREVO_FROM=your_verified_sender@example.com
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=a_long_random_string
```
> The `BREVO_FROM` sender must be verified in Brevo (Account → Senders). Email is sent via the **Brevo Transactional Email API** — there is no Gmail/SMTP anywhere in this project.

### 3. Create the database
```bash
mysql -u root -p -e "CREATE DATABASE cabuyao_cdms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p cabuyao_cdms_db < init.sql
```
`init.sql` creates the four core tables (`users`, `barangays`, `diseases`, `disease_cases`) and loads sample rows. The backend creates the remaining 21 tables automatically on first boot.

### 4. Start the servers
```bash
node server.js          # backend  → http://localhost:5000
cd frontend && npm run dev   # frontend → http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000).

> The dev server is locked to port **3000** (`strictPort: true`). If the port is genuinely taken it fails loudly instead of quietly moving to 3001, which would break the API origin.

---

## Features

### CHO (City Health Office)
- **Dashboard** — real-time stats, trend comparisons, hotspot analysis, recurring hotspots, same-period-last-year comparison, exports (Word, Excel, CSV, PDF, PowerPoint)
- **Manage Cases** — full CRUD with auto-geocoding, patient auto-fill, status tracking, and **Add / Edit request approval** tabs
- **Map View** — Leaflet map with barangay boundaries, satellite (Esri) / street (OSM) tiles, case clustering, hazard pins, and per-user scoping to your CHO Unit
- **Inbox** — referrals, edit requests (purple), add requests (blue), messages, registrations (amber)
- **Weather & Hazards** — hourly PAGASA-style alert sweep, manually pinned disasters, and linked barangay response actions
- **Audit Reports** — system-generated logs with Excel/PDF export and filtered search
- **User Accounts** — add/edit users, approve/reject BHW registrations, archive & restore accounts
- **Settings** — profile, password (CHO-approved change requests), 2FA, notification channels, appearance, language, timezone, backups, restore

### BHW (Barangay Health Worker)
- **Dashboard** — scoped to the assigned barangay with a "Top Disease" view
- **Manage Cases** — "Submit to CHO" creates an approval request; existing cases are read-only with "Edit Case to CHO"
- **Map View** — view-only map locked to the worker's barangay
- **Offline** — cases created without a network queue locally and sync on reconnect

### Resident Portal (`/Resident`)
- **Prevention Tips** — 28 disease cards with prevention tips, YouTube videos, and a symptom-checker quiz
- **Interactive Map** — public disease map with barangay risk classification and health overview
- **Contact Us** — submits concerns straight to the BHW inbox

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 + `node-cron` |
| Database | MySQL 8 (`mysql2`), schema self-migrates on boot |
| Frontend | React 19 + Vite 8 |
| Maps | React Leaflet — Esri World Imagery (HD) + OSM street (SD) |
| Auth | JWT + bcryptjs (v3) + optional 2FA |
| Email | Brevo Transactional Email API |
| SMS | Brevo Transactional SMS API |
| PWA | Workbox + vite-plugin-pwa, IndexedDB via Dexie |
| Containers | Docker + Docker Compose (dev-mode, live reload) |

---

## Project Structure

```
├── server.js                  # Backend API server (all routes + migrations + crons)
├── init.sql                   # Core schema + sample data (loaded by Docker automatically)
├── seed-demo-data.js          # Extra demo data seeder
├── geoSnap.js                 # GeoJSON polygons for geocoding
├── docker-compose.yml         # db + backend + frontend
├── Dockerfile                 # backend image
├── .env.example               # environment template
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.jsx            # Main app controller
│   │   ├── Dashboard.jsx      # Dashboard with stats and charts
│   │   ├── ManageCases.jsx    # Disease case CRUD + prevention tips
│   │   ├── MapView.jsx        # Interactive disease map + hazards
│   │   ├── UserManagement.jsx # User account management
│   │   ├── BarangayReports.jsx# Audit logs and reports
│   │   ├── WeeklySummary.jsx  # Weekly disease summary report
│   │   ├── ChoSettings.jsx    # Profile and settings
│   │   ├── ResidentApp.jsx    # Resident portal (public)
│   │   ├── disasterRisk.js    # Hazard types, icons, colours, correlations
│   │   ├── diseaseSignal.js   # Cross-tab live-update signaling
│   │   ├── syncEngine.js      # Offline sync queue
│   │   ├── offlineSync.js     # IndexedDB cache helpers
│   │   ├── db.js              # Dexie schema
│   │   ├── formatDate.js      # Shared date-format helpers
│   │   ├── exportPdf.js       # PDF export helpers
│   │   ├── config.js          # API URL config (VITE_API_URL)
│   │   ├── components/
│   │   │   ├── Login.jsx      # Login/signup/recovery flow
│   │   │   ├── DatePicker.jsx # Custom date picker (never native input[type=date])
│   │   │   └── RecoverAccount.jsx
│   │   └── resident/          # ResidentMap, PreventionTips, ContactUs, AboutCho, Help
│   ├── public/                # favicon.svg + PWA icons
│   └── vite.config.js         # Vite + PWA config
```

---

## Database

**Database name:** `cabuyao_cdms_db`

The schema is split in two:

**Seeded by `init.sql` (4 tables + sample rows)**

| Table | Description |
|-------|-------------|
| `users` | CHO and BHW accounts (seeded demo logins) |
| `barangays` | The 18 barangays of Cabuyao |
| `diseases` | The 28 tracked communicable diseases |
| `disease_cases` | Patient case records |

**Created automatically by `server.js` at startup (21 tables)**

| Table | Description |
|-------|-------------|
| `notifications` | In-app notifications |
| `notification_preferences` | Per-user email/SMS/push toggles |
| `audit_logs` | Full audit trail |
| `generated_reports` | Stored reports |
| `case_inbox` | CHO inbox items |
| `case_edit_requests` | BHW → CHO edit requests |
| `case_add_requests` | BHW → CHO add-approval requests |
| `case_status_history` | Case status transitions |
| `contact_messages` | Resident contact submissions |
| `password_change_requests` | CHO-approved password changes |
| `disease_categories` | Disease grouping |
| `disease_category_items` | Disease ↔ category links |
| `weather_alerts` | Deduplicated hourly hazard alerts |
| `weather_daily` | Cached daily weather per barangay |
| `disaster_events` | Manually pinned hazards |
| `barangay_actions` | Response actions (links to a hazard) |
| `epi_alerts` | Server-side epidemiological alerts |
| `vaccine_advisories` | Vaccine advisories |
| `user_sessions` | Session / device tracking |
| `archive_records` | Soft-deleted record archive |
| `error_logs` | Captured application errors |

> Migrations are idempotent (`CREATE TABLE IF NOT EXISTS` / `SHOW COLUMNS` guards), so restarting the backend is always safe.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | yes | Backend port (default `5000`) |
| `DB_HOST` | yes | MySQL host — `localhost` manual, `db` in Compose |
| `DB_USER` | yes | MySQL user |
| `DB_PASSWORD` | yes | MySQL password |
| `DB_NAME` | yes | Database name |
| `JWT_SECRET` | yes | Signed auth tokens |
| `BREVO_FROM` | optional | Verified Brevo sender address |
| `BREVO_API_KEY` | optional | Brevo API key (email + SMS) |
| `FRONTEND_URL` | optional | Absolute origin for email links (default `http://localhost:3000`) |
| `VITE_API_URL` | optional | Frontend API base (default `http://localhost:5000`) |

**Which file?** The backend loads `.env.local` on a manual setup. Docker Compose injects these values directly, so **a fresh clone needs no env file at all**.

---

## 18 Barangays of Cabuyao

Baclaran, Banay-Banay, Banlic, Barangay Dos (Poblacion), Barangay Tres (Poblacion), Barangay Uno (Poblacion), Bigaa, Butong, Casile, Diezmo, Gulod, Mamatid, Marinig, Niugan, Pittland, Pulo, Sala, San Isidro

## 28 Communicable Diseases Tracked

Acute Respiratory Infection, Avian Influenza, Chickenpox, Cholera, Covid-19, Dengue, Diarrhea, Diphtheria, Ebola, Hand Foot and Mouth Disease, Hepatitis A, Hepatitis B, Hepatitis C, HIV/AIDS, Influenza, Influenza A, Leprosy, Leptospirosis, Malaria, Measles, Meningococcemia, Pertussis, Poliomyelitis, Rabies, SARS, Sore Eyes, Tuberculosis, Typhoid Fever

---

## Weather & Hazard Response

- **Automatic weather hazards** — an hourly cron scans the next 6 hours for each barangay (Open-Meteo, one batched request for all 18). Alerts are deduplicated per `barangay + hazard + onset hour`, so nobody is spammed with the same rain warning all afternoon.
- **Manually pinned disasters** — CHO can pin a flood/fire/typhoon event at exact coordinates. Severe pins notify the affected barangay's BHWs immediately.
- **Response actions** — a barangay action can be linked to a hazard (`barangay_actions.hazard_id`), and creating or updating one notifies the BHWs who respond to it.
- **Map layer** — hazard badges float *above* their pin so the case count underneath stays readable; the lift scales with the pin's size.

---

## PWA & Offline Support

- Service worker precaches static assets; API responses cached with `NetworkFirst` / `StaleWhileRevalidate`
- OSM and Esri tiles cached for 30 days
- IndexedDB (Dexie) stores cases, diseases, barangays, sync queue, and reports
- A 15-second heartbeat ping to `/api/ping` drives reliable online/offline detection
- Offline creates, edits, deletes, and contact messages queue locally and sync on reconnect with last-write-wins conflict detection

---

## Deployment

| Piece | Host | Details |
|-------|------|---------|
| Frontend | **Vercel** | Root directory `frontend`; env var `VITE_API_URL` points to the Railway backend |
| Backend + MySQL | **Railway** | `https://disease-monitoring-capstone-production.up.railway.app`; secrets set in the Railway dashboard (`DB_*`/`MYSQL*`, `FRONTEND_URL`, `BREVO_*`, `JWT_SECRET`) |

Pushing to `main` redeploys both platforms.

---

## Troubleshooting

**Clone is on OneDrive**
Bind-mounting a OneDrive path into a Linux container is slow, and **Files On-Demand** can expose placeholder files as empty to the container. Clone to a non-OneDrive path (e.g. `C:\dev\`), or turn off Files On-Demand for the folder.

**Docker: port 3000 already allocated**
Something else on the host is bound to 3000. Stop it, or edit the `frontend` port mapping to e.g. `"3001:3000"`.

**Vite says "Port 3000 is in use on a wildcard address, but localhost:3000 is available"**
Harmless. Another application holds IPv4 port 3000 with a transient connection; Vite binds IPv6 instead and still serves `localhost:3000` normally.

**Vite refuses to start on port 3000**
Intentional — `strictPort: true` fails loudly rather than silently moving to 3001 and breaking every API call.

**Backend logs `MySQL pool error`**
MySQL isn't ready yet. With Compose this is handled by the healthcheck; manually, just wait a moment and restart.

**Brevo "Verify a new IP" email**
Brevo emails the account owner whenever `BREVO_API_KEY` is used from a network it hasn't seen before (new laptop, Railway redeploy with a rotated IP). This is a **Brevo account-security notice, not a Gmail prompt**. Fix it once: Brevo dashboard → **Organization Settings → Authorized IPs → API keys** → disable/unblock the addresses you don't want.

---

## License

This project was developed as a capstone project for educational purposes.
