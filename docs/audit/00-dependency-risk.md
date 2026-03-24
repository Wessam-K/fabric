# Phase 0 — Dependency Risk Report

## Backend Dependencies (10 prod, 0 dev)

| Package | Version | Purpose | Risk |
|---|---|---|---|
| bcryptjs | ^3.0.3 | Password hashing | ✅ Low — pure JS, no native deps |
| better-sqlite3 | ^11.7.0 | SQLite driver | ✅ Low — actively maintained, native |
| cors | ^2.8.5 | CORS middleware | ✅ Low |
| dotenv | ^16.4.7 | Env config | ✅ Low |
| express | ^4.21.1 | HTTP framework | ✅ Low — industry standard |
| helmet | ^8.1.0 | Security headers | ✅ Low |
| jsonwebtoken | ^9.0.3 | JWT signing | ✅ Low |
| morgan | ^1.10.1 | Request logging | ✅ Low |
| multer | ^1.4.5-lts.1 | File uploads | ⚠️ Medium — LTS fork, needs monitoring |
| **xlsx** | **^0.18.5** | Excel I/O | **🔴 HIGH — 2 known CVEs (see below)** |

## Frontend Dependencies (8 prod, 4 dev)

| Package | Version | Purpose | Risk |
|---|---|---|---|
| axios | ^1.13.6 | HTTP client | ✅ Low |
| chart.js | ^4.5.1 | Charts | ✅ Low |
| lucide-react | ^0.577.0 | Icons | ✅ Low |
| react | ^19.2.4 | UI framework | ✅ Low |
| react-chartjs-2 | ^5.3.1 | Chart wrapper | ✅ Low |
| react-dom | ^19.2.4 | React DOM | ✅ Low |
| react-router-dom | ^7.13.1 | Routing | ✅ Low |
| recharts | ^3.8.0 | Charts | ✅ Low |
| **xlsx** | **^0.18.5** | Excel export | **🔴 HIGH — same CVEs** |

## Known Vulnerabilities

### CVE-1: xlsx — Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
- **Severity**: HIGH (CVSS 7.8)
- **Affected**: xlsx < 0.19.3
- **Impact**: Attackers can inject properties via crafted Excel files
- **Fix Available**: No (xlsx is unmaintained; recommend migration to `xlsx-populate` or `exceljs`)
- **Mitigation**: Server-side file validation, limit upload size, sanitize parsed data

### CVE-2: xlsx — ReDoS (GHSA-5pgg-2g8v-p4x9)
- **Severity**: HIGH (CVSS 7.5)
- **Affected**: xlsx < 0.20.2
- **Impact**: Denial of service via crafted spreadsheet
- **Fix Available**: No
- **Mitigation**: Process uploads in worker thread with timeout, limit file size

## Unused Dependencies

| File | Package | Status |
|---|---|---|
| backend/validators.js | (dead code) | Unused — never imported |
| backend/utils/validators.js | (dead code) | Unused — never imported |

## Duplicate Libraries

- `xlsx` appears in both backend and frontend package.json (same version)
- `chart.js` + `recharts` — two charting libraries (recharts likely primary)

## Recommendations

1. **P1**: Replace `xlsx` with `exceljs` (actively maintained, no CVEs)
2. **P2**: Remove dead validator files
3. **P3**: Consolidate to single charting library
4. **P3**: Consider `express-rate-limit` to replace custom rate limiter
