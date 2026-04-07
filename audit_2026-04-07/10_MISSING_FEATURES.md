# Missing Features & Backup Audit

## Missing/Incomplete Features

### FEAT-1: Report Scheduling Execution — HIGH
- **UI:** Full CRUD — create/edit/toggle/delete schedules, frequency/recipients/format
- **Backend:** CRUD + `computeNextRun()` only
- **Missing:** No cron job, no setInterval, no background process that checks `next_run_at`, generates reports, or sends emails. Schedules are saved but **never fire**.
- `last_run_at` always empty. Recipients never receive emails.

### FEAT-2: Email Delivery Not Configured — MEDIUM
- `backend/utils/mailer.js` properly uses `nodemailer` with SMTP config via env vars
- Falls back to logger when `SMTP_HOST` not set
- Password reset emails silently fail in dev mode
- **Not a code bug** — needs SMTP env configuration for production

### FEAT-3: Backup Restore Requires Full Restart — MEDIUM
- Restore creates `pending_restore.json` marker, copies backup over DB on next startup
- After `db.close()`, the better-sqlite3 singleton won't re-open
- **Requires full process restart** — not just HTTP-level restart

### FEAT-4: SalesOrders Page Not Wired — HIGH
- `SalesOrders.jsx` exists but no route in App.jsx
- Notifications link to `/sales-orders` → hits 404
- Either wire the route or remove the page

---

## Fully Functional Features ✅

| Feature | Status |
|---|---|
| Knowledge Base | Full client-side help system with search, 9 categories |
| Real-time Notifications | SSE + WebSocket, JWT auth, IP rate limiting |
| Webhook Delivery | AES-256-GCM secrets, HMAC signing, exponential backoff, auto-disable after 10 failures |
| Auto-Backup | Every 6h (configurable), max 10 retained, WAL checkpoint before backup |
| Manual Backup | `db.backup()` native API, audit logged |

---

## Backup System Assessment

| Feature | Status |
|---|---|
| Manual backup (create) | ✅ Works |
| Auto backup (6h cycle) | ✅ Works |
| Backup retention (max 10) | ✅ Works |
| WAL checkpoint before backup | ✅ Works |
| Backup restore | ⚠️ Partial — needs full process restart |
| Backup storage | `backend/backups/` directory |
| Permission protection | ✅ `backups:view/create/delete` |
| Audit logging | ✅ All operations logged |

---

## Test Results

| Metric | Value |
|---|---|
| Total tests | 1,464 |
| Pass | 1,464 |
| Fail | 0 |
| Duration | 70.2s |

**All tests passing** as of latest test run (test-full9.txt).
