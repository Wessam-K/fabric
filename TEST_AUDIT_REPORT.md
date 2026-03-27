# WK-Factory Test Coverage Audit Report
> Date: March 27, 2026 | Tests: 58 API tests, 27 E2E tests

## 7.1 Existing Test Analysis

### API Tests (backend/tests/api.test.js)
**58 tests across 28 suites — ALL PASSING ✅**

| Suite | Tests | What's Tested |
|-------|-------|---------------|
| Health Check | 1 | GET /api/health returns ok |
| Auth | 3 | Login, invalid login, /me endpoint |
| Settings | 2 | GET/PUT settings |
| Fabrics | 3 | CRUD operations |
| Accessories | 3 | CRUD operations |
| Models | 3 | CRUD + BOM |
| Customers | 3 | CRUD operations |
| Suppliers | 3 | CRUD operations |
| Work Orders | 3 | Create, list, detail |
| Invoices | 3 | CRUD + finalize |
| Purchase Orders | 3 | CRUD + receive |
| HR Employees | 3 | CRUD operations |
| Attendance | 2 | Mark attendance, list |
| Payroll | 2 | Calculate, list |
| Expenses | 3 | CRUD operations |
| Quality | 2 | Templates, inspections |
| Machines | 3 | CRUD operations |
| Maintenance | 3 | CRUD operations |
| Quotations | 2 | Create, list |
| Samples | 2 | Create, list |
| Shipping | 2 | Create, list |
| Returns | 2 | Create, list |
| Scheduling | 1 | List |
| MRP | 1 | Calculate |
| Reports | 2 | Summary, work orders |
| Notifications | 1 | List |
| Exports | 1 | Export endpoint |
| Backups | 1 | List backups |

### Test Quality Assessment

| Aspect | Status | Details |
|--------|--------|---------|
| Test isolation | ⚠️ Weak | Shared global TOKEN, no per-test cleanup |
| Deterministic | ✅ | Same results on repeat runs |
| Cleanup | ⚠️ Partial | Creates test data but doesn't always clean up |
| Coverage depth | ⚠️ Shallow | Most tests only verify HTTP 200, not response shape |

### E2E Tests (e2e/screenshots.spec.js)
- 27 Playwright test scenarios
- Covers page navigation, screenshots, basic interactions
- Uses `.auth-state.json` for persistent login

## 7.2 Coverage Gaps — CRITICAL MISSING TESTS

### 🔴 Not Tested: Role-Based Access Control (RBAC)
| Missing Test | Why Critical |
|-------------|-------------|
| Viewer cannot POST/PUT/DELETE | Privilege escalation |
| HR role cannot access finance endpoints | Data isolation |
| Production role cannot access HR data | Data isolation |
| Non-superadmin cannot manage users | Admin bypass |
| Non-superadmin cannot manage permissions | Admin bypass |

### 🔴 Not Tested: Input Validation Edge Cases
| Missing Test | Why Critical |
|-------------|-------------|
| SQL injection attempts (`'; DROP TABLE--`) | Data destruction |
| XSS payloads in text fields | Script injection |
| Negative numbers for quantities/amounts | Business logic bypass |
| Extremely large numbers (overflow) | Calculation errors |
| Empty required fields | Data integrity |
| Invalid date formats | Query errors |

### 🔴 Not Tested: Authentication Edge Cases
| Missing Test | Why Critical |
|-------------|-------------|
| Expired token rejected | Session hijacking |
| Invalid token format rejected | Auth bypass |
| Account lockout after 5 attempts | Brute force protection |
| Locked account cannot login during lockout | Lockout bypass |
| Password change requires old password | Password theft |
| Password history prevents reuse | Weak passwords |

### 🟡 Not Tested: Business Logic
| Missing Test | Impact |
|-------------|--------|
| Work order stage transitions | Skip stages |
| Payroll calculation accuracy | Financial errors |
| Invoice totals match items | Financial errors |
| Stock deduction on PO receive | Inventory mismatch |
| Concurrent operations | Race conditions |

## 7.3 Recommendations

### Priority 1: Security Tests (Add ~20 tests)
```javascript
// RBAC: Verify viewer cannot create work orders
// RBAC: Verify hr role cannot access /api/invoices
// RBAC: Verify non-superadmin cannot POST /api/users
// Auth: Verify expired token returns 401
// Auth: Verify lockout after 5 failed attempts
// Input: Verify SQL injection strings are harmless
// Input: Verify negative quantities rejected
```

### Priority 2: Business Logic Tests (Add ~15 tests)
```javascript
// WO: Verify stage advance only works for in_progress WO
// WO: Verify quantity overflow protection
// Invoice: Verify total = sum(items)
// Payroll: Verify calculation matches expected output
// Inventory: Verify stock levels after PO receive
```

### Priority 3: Edge Case Tests (Add ~10 tests)
```javascript
// Pagination: limit=0, limit=-1, page=0
// Search: empty string, very long string
// Concurrent: Two users editing same record
// Delete: Cascade behavior verification
```

## Current Coverage Score: 55/100
- Core CRUD: 90% covered
- Security: 10% covered
- Business logic: 30% covered
- Edge cases: 5% covered
