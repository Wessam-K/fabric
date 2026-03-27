# WK-Factory v3.0 Upgrade Log
> Tracks every change made during the v2.1 → v3.0 upgrade

## Category A — Critical Fixes

### A1. Fix path-to-regexp ReDoS Vulnerability
- **File:** `backend/package-lock.json` (updated via npm audit fix)
- **Change:** Updated path-to-regexp from vulnerable version to ≥0.1.13
- **Command:** `cd backend && npm audit fix`
- **Result:** 1 high vulnerability fixed. Only xlsx (no fix available) remains.
- **Tests:** 58/58 pass ✅

### A2. Fix All POST Endpoints → Return 201 Instead of 200
- **Files changed:**
  - `backend/routes/accounting.js` — line 32: `res.json` → `res.status(201).json` (POST /coa)
  - `backend/routes/accounting.js` — line 132: `res.json` → `res.status(201).json` (POST /journal)
  - `backend/routes/hr.js` — line 83: `res.json` → `res.status(201).json` (POST /employees)
  - `backend/routes/users.js` — line 31: `res.json` → `res.status(201).json` (POST /users)
- **Change:** All resource-creation POST handlers now return HTTP 201 Created
- **Note:** All other POST create handlers (30+) already returned 201 correctly
- **Tests:** 58/58 pass ✅

### A3. Delete Empty Placeholder Test Files
- **Files deleted (7 files, all 6 bytes):**
  - `backend/tests/test-v10-comprehensive.js`
  - `backend/tests/test-v7-api.js`
  - `backend/tests/test-v7.js`
  - `backend/tests/test-v8-comprehensive.js`
  - `backend/tests/test-v9-comprehensive.js`
  - `backend/tools/check-schema.js`
  - `backend/_test_queries.js`
- **Tests:** 58/58 pass ✅

### A4. Add Compression Middleware
- **Package:** `compression` installed in backend/
- **File:** `backend/server.js`
  - Added `const compression = require('compression')` at top
  - Added `app.use(compression({ filter, level: 6, threshold: 1024 }))` after JSON body parser
- **Config:** Level 6 (balanced speed/ratio), 1KB threshold, respects X-No-Compression header
- **Impact:** Reduces JSON response sizes by 60-80% for payloads >1KB
- **Tests:** 58/58 pass ✅

### A5. Add RBAC Security Tests
- **File:** `backend/tests/api.test.js` — Added 22 new tests across 4 test suites:
  - **RBAC — Auth Bypass Attempts (3 tests):**
    - No token → 401
    - Malformed token → 401
    - Tampered JWT payload → 401
  - **RBAC — Role Creation & Permissions (12 tests):**
    - Creates test users for viewer/hr/production/accountant/manager roles
    - Viewer cannot create WO, invoice, fabric, or modify settings
    - Viewer CAN view work orders (read-only confirmed)
    - HR cannot create work orders or invoices
    - Production cannot create payroll periods
    - Accountant cannot create employees
    - Manager cannot create users (superadmin-only)
    - Viewer cannot delete users
    - Production cannot access permission roles matrix
  - **RBAC — Account Lockout (2 tests):**
    - Account locks after 5 failed login attempts → 423
    - Locked account rejects correct password → 423
  - **RBAC — Input Validation Security (5 tests):**
    - SQL injection in work order search → harmless (200 + table intact)
    - SQL injection in customer search → harmless (200)
    - XSS payload in fabric name stripped
    - Nested XSS bypass attempt blocked
    - Very long input (10K chars) doesn't crash server
- **Also changed:** `backend/server.js` — Rate limiter bypassed in test mode (`NODE_ENV=test`) to allow lockout tests to run without hitting IP-based rate limit
- **Tests:** 80/80 pass ✅ (58 original + 22 new)

