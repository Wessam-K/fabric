# Production Deployment Checklist

## Pre-Deployment Requirements

### 1. Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Set strong `JWT_SECRET` (min 64 chars, crypto.randomBytes)
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` for email
- [ ] Set `SENTRY_DSN` for error tracking
- [ ] Set `CORS_ORIGIN` to exact frontend domain
- [ ] Set `BACKUP_DIR` to persistent external storage
- [ ] Set `AUTO_BACKUP_HOURS` (default: 6)
- [ ] Consider setting `WEBHOOK_ENCRYPTION_KEY` independent of JWT_SECRET

### 2. Security Hardening
- [x] JWT algorithm explicitly HS256 (fixed this audit)
- [x] 2FA user enumeration fixed (fixed this audit)
- [x] DELETE blocking middleware active
- [x] Webhook DELETE bypass removed (fixed this audit)
- [ ] Change default seed user passwords
- [ ] Increase password minimum to 12 characters
- [ ] Add rate limiting to `/api/auth/forgot-password`
- [ ] Review and set `SameSite=strict` on auth cookies
- [ ] Enable HSTS preload

### 3. Database
- [x] V55 migration applied (permission gaps fixed)
- [x] Foreign keys enabled (PRAGMA)
- [x] WAL mode + synchronous=NORMAL
- [ ] Verify backup directory is writable
- [ ] Test backup restore process end-to-end
- [ ] Remove/change seed user accounts from production DB
- [ ] Add missing indexes on journal_entry_lines and journal_entries

### 4. Performance
- [ ] Remove orphaned frontend components (9 files)
- [ ] Remove orphaned backend `apiResponse.js`
- [ ] Remove unused `broadcast` import from server.js
- [ ] Consider pagination for purchaseorders, machines, maintenance, shipping, samples, scheduling, returns endpoints
- [ ] Monitor dashboard endpoint response time (30+ queries per request)

### 5. Feature Decisions
- [ ] Wire SalesOrders.jsx to router OR remove it
- [ ] Implement report scheduling execution engine OR disable/hide scheduling UI
- [ ] Fix sidebar permission mismatches (quotations, samples)
- [ ] Fix invoice view permission check (`/invoices/:id/view` has no perm)

### 6. Financial Accuracy
- [ ] Fix `calculateWOCost` to use safeAdd/safeMultiply
- [ ] Add `subcontract_cost` to finalize endpoint total
- [ ] Align BOM matrix and WO waste calculation (presentation consistency)
- [ ] Fix lining waste dropped in WO legacy path
- [ ] Link partial_invoices to standard invoices via `invoice_id` FK
- [ ] Normalize P&L endpoints to use consistent cost definition

### 7. Testing
- [x] 1,464/1,464 tests pass (test-full9.txt)
- [ ] Add test coverage for 2FA with tfa_token flow
- [ ] Add test coverage for V55 permission changes
- [ ] Add tests for DELETE middleware rejection (verify 403)
- [ ] Run tests against production-like dataset

### 8. Monitoring & Logging
- [ ] Replace `console.log/error/warn` (607 occurrences) with structured logger
- [ ] Add request context to 500 error logs (req.path, req.method)
- [ ] Configure Sentry for error tracking
- [ ] Set up uptime monitoring for `/api/health`

### 9. Documentation
- [x] Architecture documented (01_ARCHITECTURE.md)
- [x] Module inventory complete (02_MODULES_INVENTORY.md)
- [x] Security audit documented (12_SECURITY_AUDIT.md)
- [x] All findings documented (03_BUGS_AND_ISSUES.md)
- [ ] Create API documentation (Swagger is already at `/api/docs`)
- [ ] Create user manual (Arabic)
- [ ] Document backup/restore procedures

---

## Production Readiness Score

| Category | Score | Notes |
|---|---|---|
| Security | 85/100 | 4 critical/high fixes applied. Password min length and reset rate limiting pending. |
| Data Integrity | 75/100 | DELETE blocking works. REAL float monetary columns remain. Missing indexes. |
| API Quality | 80/100 | 100% try/catch, consistent error format. Pagination gaps on 9 endpoints. |
| UI/UX | 85/100 | RTL/Arabic fully supported. 2 permission mismatches. SalesOrders orphaned. |
| Testing | 90/100 | 1,464 tests, 100% pass. Good coverage. |
| Performance | 80/100 | N+1 query in reports. Dashboard 30+ queries. 9 orphaned components. |
| Features | 85/100 | Report scheduling non-functional. Email not configured. Backup restore needs restart. |
| Documentation | 90/100 | Comprehensive audit docs. Swagger API docs. In-app knowledge base. |

**Overall: 84/100 — READY FOR PRODUCTION with documented caveats**
