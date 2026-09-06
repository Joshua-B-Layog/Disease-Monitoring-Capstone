# Disease Monitoring Capstone - AI Instructions

## Project Overview
This is a Web-Based Disease Monitoring and Mapping System for the City of Cabuyao, Laguna, Philippines. Built for the City Health Office (CHO) and Barangay Health Workers (BHW).

## Tech Stack
- Backend: Node.js + Express.js + MySQL (mysql2)
- Frontend: React + Vite
- Maps: React Leaflet — HD layer = Esri World Imagery (satellite, keyless), SD layer = OSM street tiles (`tile.openstreetmap.org`)
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
- `frontend/src/WeeklySummary.jsx` — weekly disease summary report (notification-only page)
- `frontend/src/ChoSettings.jsx` — profile and settings
- `frontend/src/components/Login.jsx` — full login/signup/recovery flow
- `frontend/src/ResidentApp.jsx` — resident portal (Map, About, Contact, Help, Tips)
- `frontend/src/resident/*` — ResidentMap, ContactUs, AboutCho, Help, PreventionTips
- `frontend/src/diseaseSignal.js` — cross-tab live-update signaling for disease/prevention data
- `frontend/public/favicon.svg` — CHO 1 logo favicon (replaces the Vite lightning bolt)

## Database: cabuyao_cdms_db
Tables: users, barangays, diseases, disease_cases, notifications, notification_preferences, case_edit_requests

## User Roles
- CHO (City Health Office) — admin, full access; can edit all cases; approves/rejects BHW registrations
- BHW (Barangay Health Worker) — field worker, limited access; adds cases, requests edits via CHO; self-registration requires CHO approval

## 18 Barangays of Cabuyao
Baclaran, Banay-Banay, Banlic, Barangay Dos (Poblacion),
Barangay Tres (Poblacion), Barangay Uno (Poblacion), Bigaa,
Butong, Casile, Diezmo, Gulod, Mamatid, Marinig, Niugan,
Pittland, Pulo, Sala, San Isidro

## 28 Communicable Diseases Tracked
Acute Respiratory Infection, Avian Influenza, Chickenpox, Cholera, Covid-19, Dengue,
Diarrhea, Diphtheria, Ebola, Hand Foot and Mouth Disease, Hepatitis A, Hepatitis B,
Hepatitis C, HIV/AIDS, Influenza, Influenza A, Leprosy,
Leptospirosis, Malaria, Measles, Meningococcemia, Pertussis, Poliomyelitis, Rabies,
SARS, Sore Eyes, Tuberculosis, Typhoid Fever

## Role-Based Case Management Rules
- CHO: "+ Add Case" hidden; can edit all cases (including BHW-submitted edit requests)
- BHW: Adds cases; existing case form is read-only; "Update Case" replaced by "Edit Case to CHO" button → sends note to CHO inbox
- `case_edit_requests` table stores BHW→CHO edit requests (auto-migrates)
- "Edit Requests" tab (purple) in CHO inbox alongside Referrals and Messages
- Notification "View →" parses disease name from message via regex `/case of (.+?) \(/` and calls `setCaseFilter({ disease: diseaseName, ... })` — same mechanism as MapView's "Go To →"
- `tabMap` object maps `'ManageCases'`→`'Manage Cases'`, `'Inbox'`→`'Manage Cases'`, `'MapView'`→`'Map View'`, `'Weekly Summary'`→`'Weekly Summary'`
- Edit request notifications bypass user preferences (direct BHW→CHO work request always delivers)
- Routing modal for misplaced barangay cases has two centered buttons: `✕ Delete` and `→ Send to CHO I/II`
- Inbox "Back" then re-clicking "Inbox" resets to Referrals tab, not Edit Requests
- `notifSaveMsg` and `systemPrefsSaveMsg` cleared on view change in ChoSettings
- Weekly Summary page is notification-only (no sidebar entry); accessible via "View →" on weekly summary notifications or via test button in ChoSettings
- Weekly summary notification `link_to` = `'Weekly Summary'` → renders `WeeklySummary.jsx` component
- Backend cron job: `server.js` — `cron.schedule('0 17 * * 5', ...)` — every Friday 5PM
- BHW self-registration sets `is_active=0, status='pending'` → CHO gets notification → CHO approves/rejects from Registrations tab (amber, 4th tab in inbox) → approval sets `is_active=1, status='approved'`, rejection sets `status='rejected'` — both send email
- `status` column: `VARCHAR(20) DEFAULT NULL` (NULL = admin-created CHO accounts, no approval needed)
- Registration notifications: `link_to: 'Registrations'` → routes to `inbox:registrations` sub-tab
- Login blocks pending (`status='pending'`) and rejected (`status='rejected'`) accounts with descriptive error messages

## UI, Theming & Map Behavior (recent updates)
- Map layers: **SD** = OSM street (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), **HD** = Esri World Imagery satellite (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`) — both keyless, no "API key required" watermark. Previously used Google `vt/lyrs=s` (watermarked) and Carto SD.
- CHO/BHW map (`MapView.jsx`) is scoped to the logged-in user's area of responsibility:
  - `roleBounds` memo: CHO → `getCombinedBounds(CHO_UNIT_BARANGAYS[sessionContext])`; BHW → `getBarangayBounds(loginBarangay)` padded; fallback `CABUYAO_BOUNDS`
  - `ScopeEnforcer` child (`useMap`): sets the map's `maxBounds` + raises `minZoom` to `round(getBoundsZoom(bounds))` (clamped 12–18) so the user cannot zoom out past their area filling the screen; recomputed on `resize`; `maxBoundsViscosity` = 1.0
  - Resident map (`ResidentMap.jsx`) intentionally stays full-city (residents browse all 18 barangays)
- Theme is split into 3 independent scopes:
  - **CHO/BHW app**: per-user key `cdms_theme_<userId>` (loaded on login, saved on change; default `dark`) — each CHO Unit I / CHO Unit II / BHW barangay account keeps its own light/dark
  - **Login screen**: reflects the **last user's** saved preference via `cdms_last_user` marker; the login `☀️/🌙` toggle edits that same per-user preference — the login side always matches the account's settings (after logout the login shows the outgoing user's theme)
  - **Resident portal**: own key `cdms_resident_theme` (default `light`, one-time seed from legacy `cdms_theme`)
  - `<html data-theme>` = `isLoggedIn ? appTheme : loginTheme`; `<RecoverAccount>` uses the login theme
- Favicon: `frontend/public/favicon.svg` is the CHO 1 logo (navy + yellow caduceus/sun emblem), replacing the Vite lightning bolt (localhost + Vercel + MapView tab icon)
- TV / large-screen scaling (App.css + resident.css): `--scale` fires only at `min-width: 2560px` (1.15x) and `min-width: 3840px` (1.3x); the user's 1880x1287 screen gets no scaling; `.resident-map-area { height: min(60vh, 520px) }` unchanged
- Disease Prevention Tips (CHO side, `ManageCases.jsx`):
  - Box 1 = "Add Disease" card; adding a disease shows a Yes/No prompt — Yes auto-loads it into Box 2, then a "Disease added!" toast
  - Box 2 = "Add/Edit Prevention Tips" panel: custom disease dropdown (`.mc-custom-dropdown-btn/panel/item`, outside-click close), Prevention Tips / Symptom Checker / Video URL fields, `💾 Save Prevention Tips` + `✏️ Manage Prevention Tips` side-by-side
  - Manage modal: per-disease Hide/Unhide toggle with `window.confirm` (Hide = soft-delete via `active=0`, Resident portal only; `PATCH /api/diseases/:id/visibility`)
  - Resident `PreventionTips.jsx` merges diseases and skips any with `active === 0`
- Live resident updates via `frontend/src/diseaseSignal.js` (`BroadcastChannel('cdms_diseases')` + `localStorage['cdms_diseases_rev']`):
  - CHO `ManageCases.jsx` emits after add disease / save tips / save Box 2 tips / toggle visible
  - Resident Tips refetches cache-busted (`?_=${Date.now()}`, `cache:'no-store'`) on mount / focus / visibilitychange / signal, plus 30s poll; ResidentMap refetches on signal (already had 30s poll). No "Updated X secs ago" label on the resident side.

## Important Rules When Editing
- Never hardcode colors — always use CSS variables for themed components
- Status values: Active, Pending, Under Treatment, Recovered, Deceased, Draft
- All API calls go to http://localhost:5000
- Frontend runs on http://localhost:3000
- Always preserve existing working features when adding new ones
- MySQL passwords are stored as plain text (no hashing yet)
- The .env file holds DB credentials and email/SMS keys
- Brevo SMS setup: 1) Ensure BREVO_API_KEY is set in .env (same key as email), 2) SMS sender name is 'Cabuyao', 3) Phone numbers are automatically formatted to international format (+63...) by formatPhone()

## PWA & Offline Support (Phase 1 + Phase 2 + Full Offline)
- Service worker auto-generated by `vite-plugin-pwa` + Workbox (`dist/sw.js`)
- Static assets precached; API responses cached with runtime strategies:
  - `/api/diseases` + `/api/barangays`: `StaleWhileRevalidate` (24h)
  - `/api/disease_cases`: `NetworkFirst` (5s timeout, 1h cache)
  - Other `/api/*`: `NetworkFirst` (5s timeout, 1h cache)
  - OpenStreetMap tiles: `CacheFirst` (30 days, 500 entries)
- IndexedDB via `dexie.js` (v3) stores: `cases`, `diseases`, `barangays`, `referenceData`, `syncQueue`, `users`, `auditLogs`, `generatedReports`, `userProfiles`, `weeklySummaries`
- `offlineSync.js` — cache/fallback helpers for all stores; `db.js` — Dexie schema
- All pages now have offline fallback: Dashboard, ManageCases, MapView, ResidentMap, UserManagement, BarangayReports, ChoSettings, WeeklySummary, ContactUs
- Pattern: on successful fetch → cache to IndexedDB; on network error → load from IndexedDB, show offline banner; polling intervals skip when offline
- App.jsx: heartbeat pings `/api/ping` every 15s for reliable online detection (replaces `navigator.onLine` alone); bell indicator flips to "Offline" automatically
- `GET /api/ping` endpoint in server.js (200 OK) for connectivity detection
- Notification + sync count polling paused when offline (no console error flood)
- `frontend/src/apiConfig.js` is unused duplicate of `config.js` — can be deleted
- Phase 2 (offline CRUD + sync queue) is implemented:
  - `syncEngine.js` — enqueue operations, process FIFO queue with retry
  - ManageCases.jsx: create/edit/delete cases queue offline when no network
  - ContactUs.jsx: contact messages queue offline when no network
  - `POST /api/sync` endpoint — server processes queued ops, creates audit logs, handles conflicts
  - Floating sync button (bottom-right) with pending count badge
  - Auto-sync triggers on reconnect (heartbeat detection); manual sync button always available
  - Conflict detection: edits use `updated_at` timestamp comparison (last-write-wins), flagged in results
  - `OfflineSyncPanel` in ChoSettings → Data Management shows queue items with status/pending count
  - Creates logged as "Synced Case (Offline)" / "Synced Edit (Offline)" / "Synced Delete (Offline)" in audit trail

## Frontend / Backend Architecture (for IT Experts & Clients)
### Backend — `server.js` (Node.js + Express + MySQL)
- REST API with all routes in `server.js`; DB credentials + email/SMS keys come from `.env`
- MySQL `cabuyao_cdms_db` (7 tables): users, barangays, diseases, disease_cases, notifications, notification_preferences, case_edit_requests
- Auth: login/signup/recovery, per-role access (CHO admin vs BHW), BHW self-registration + CHO approval workflow
- Notifications: Nodemailer (Gmail) for email, Brevo for SMS; in-app inbox with Referrals / Edit Requests / Messages / Registrations tabs; weekly summary cron every Friday 5PM
- Offline sync: `POST /api/sync` processes queued offline CRUD with `updated_at` conflict detection (last-write-wins) and writes audit logs
- Schema self-migrates at server startup; `init.sql` is a reference dump, NOT auto-loaded

### Frontend — React + Vite
- CHO/BHW portal: Dashboard, Manage Cases (CRUD + inbox + referrals), Map View, User Management, Barangay Reports, Weekly Summary, Settings/Profile
- Resident portal (`/Resident` route): public Map, About, Contact, Help, Prevention Tips
- Auth screens: Login, Recover Account, Reset Password, Verify 2FA (use the login theme)
- Maps: React Leaflet — Esri satellite (HD) / OSM street (SD), barangay polygons, case markers, per-user view scoping
- Offline/PWA: Workbox service worker + Dexie IndexedDB + offline sync queue
- Live updates: BroadcastChannel signaling for disease/prevention data; 15s heartbeat ping (`GET /api/ping`) for reliable online/offline detection

### Deployment
- Frontend → Vercel (root dir `frontend`); `VITE_API_URL` env var must point to the Railway backend
- Backend + MySQL → Railway (`https://disease-monitoring-capstone-production.up.railway.app`)
- Backend env vars (DB_*/MYSQL*, FRONTEND_URL, BREVO_*, etc.) set manually in the Railway dashboard