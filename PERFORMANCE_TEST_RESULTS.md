# CDMS Performance / Time Behaviour Test Results

ISO/IEC 25010 — Quality Attribute: **1.1 Time Behaviour**

## Method

- Tool: **k6** load-testing (script: `k6-load-test.js`)
- Target: live production backend, Railway deployment
  (`https://disease-monitoring-capstone-production.up.railway.app`)
- Load profile: ramp **1 → 20 → 50 → 100 concurrent users**, held at 100 for 2 minutes
- Reported metric: **95th-percentile latency (p95)**
- Requests fired: **59,811** — **0 errors** (100% success rate) at peak 100 users
- Throughput observed: ~153 requests/second
- Date measured: September 2026

## Results

| # | Statement (Table 1.1) | Measured (p95) | Average |
|---|---|---|---|
| 1 | The system responds to user requests within the specified response time | **294 ms** | 234 ms |
| 2 | The system loads disease maps within the specified loading time | **321 ms** (map data) | 235 ms |
| 3 | The system generates epidemiological reports within the specified processing time | **329 ms** (weekly summary) | 259 ms |
| 4 | The system processes disease records within the specified processing time | **291 ms** (case creation) | 226 ms |

## Conclusion

At **100 concurrent users**, every tested operation completes in roughly 0.3 seconds,
well within the referenced targets (response ≤ 2 s, map ≤ 3 s, report ≤ 5 s, record ≤ 2 s).

## Notes

- Item 2 measures the map's **data** load (barangay boundaries + case markers).
  The satellite/street tile images are served by third-party CDNs (OSM / Esri) and
  depend on internet speed; tiles are cached client-side for 30 days, so repeat
  map views load in under ~1 s.
- The single worst observed request was 4.29 s (pool warm-up / notification write);
  the p95 values above reflect typical sustained behavior.

## Local re-validation — Phase 9 (indexes + pagination) — September 22, 2026

Read-path hardening was validated against the **local backend** (MySQL, ~5,030 disease
cases + 15 new composite indexes) using the same k6 ramp to 100 users. The matrix
mirrors the app's real read shapes: disease-case list reads (500-row pages), user
notifications, audit logs, disease + barangay reference data.

| Metric | Result |
|---|---|
| Requests fired | **33,353** |
| Failure rate | **0.00%** (threshold: < 1%) |
| Latency p95 | **528.75 ms** (threshold: < 2000 ms) |
| Latency p90 / avg / max | 474.6 ms / 253.3 ms / 1,282.8 ms |
| Throughput | ~276 requests/sec (peak VU = 100) |
| Endpoint checks | 8/8 at 100% (33,352/33,352 checks) |

### Changes that made this pass possible (caught by the load test)

1. **Unfiltered `/api/disease_cases` returned all ~5,030 rows per call** (multi-MB body).
   Added additive `?limit=&offset=` pagination (max 1,000/page; default behavior unchanged).
   - Note: this is why the original Railway test reused the pre-seeded dataset — the
     post-seed dataset requires the app callers to paginate; that is Part 2 work.
2. **`GET /api/audit-logs` and `GET /api/notifications` pagination bug:** `limit` was passed
   as a bound parameter, and the missing `offset` defaulted to `null`, producing
   `LIMIT 50 OFFSET null` (SQL error → 500). Now inlined sanitized integers, `offset` defaults to 0.
   - This bug had produced a consistent **25% failure rate** under load (the only
     endpoints that passed through `authenticate` in the matrix).
3. **Read-path indexes:** `ensureIndexes()` (15 indexes across cases/notifications/audit
   logs/status history/inbox/approval tables/users) verified present at boot
   (`Index check: all 15 read-path index(es) present.`).

## Re-testing

The k6 load-test script is regenerated on demand (k6 is installed locally at
`C:\Program Files\k6\k6.exe`; test credentials come from `cdms_session` →
`.token` in DevTools > Application > Local Storage). The script was removed
from the repository to avoid carrying login credentials in the codebase.

## Cleanup after a test run

The test creates private Draft cases named `LoadTest_...`. Remove them:

```sql
DELETE FROM disease_cases WHERE patient_name LIKE 'LoadTest_%';
```