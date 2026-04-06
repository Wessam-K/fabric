# Code Citations

## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```


## License: unknown
https://github.com/HyeongJinK/Study/blob/ca9e75131d0796842af0696513901eda2595821f/PStudy/React_GraphQL/1/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/GabrielSalangsang013/ts-mern-with-auth-boilerplate/blob/c5ef736c2023927b96b91c18d494e3274670285c/backend/src/server.ts

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob
```


## License: unknown
https://github.com/trannhutle/graphql_and_react/blob/9905a2ecc0ee0e49c673aa8119326fbaf2eff675/src/server/index.js

```
Here is the compiled **Comprehensive Security Audit Report** for the WK-Factory application:

---

## WK-Factory Security Audit Report

### 1. Secrets Management — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT secret auto-generated (64-byte random hex), stored in `.jwt_secret` with mode `0o600` | — | ✅ Good |
| `.gitignore` excludes `.jwt_secret`, `*.db`, `.env` | — | ✅ Good |
| Seed script logs `password: 123456` to console ([seed.js](fabric/backend/seed.js#L439)) | Low | ⚠️ Dev-only, acceptable |
| No hardcoded production secrets found anywhere | — | ✅ Good |

**Recommendation:** None critical. Seed password logging is dev-only.

---

### 2. Input Validation & SQL Injection — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| All 50+ SQL queries use parameterized statements (`db.prepare(...).run/get/all(params)`) | — | ✅ Good |
| Global HTML tag stripping middleware ([server.js](fabric/backend/server.js#L110-L126)) | — | ✅ Good |
| Field length cap at 10,000 chars ([server.js](fabric/backend/server.js#L89-L103)) | — | ✅ Good |
| Query param sanitization | — | ✅ Good |
| No `eval()`, `exec()`, `Function()` usage | — | ✅ Good |
| No stack trace exposure in error responses | — | ✅ Good |

**Recommendation:** None. Input handling is solid.

---

### 3. Authentication & Authorization — **LOW RISK** ✅

| Finding | Severity | Status |
|---------|----------|--------|
| JWT tokens with proper expiration | — | ✅ Good |
| Token blacklist on logout (in-memory, 24h cleanup) | — | ✅ Good |
| Password policy enforced (8+ chars, uppercase, digit) | — | ✅ Good |
| Password history (5 past passwords checked) | — | ✅ Good |
| All routes use `requireAuth` + `requirePermission` properly | — | ✅ Good |
| `notifications` routes protected via mount-level `requireAuth` ([server.js](fabric/backend/server.js#L237)) | — | ✅ Good |
| RBAC with granular permission system | — | ✅ Good |
| All DELETE routes require `requirePermission` | — | ✅ Good |
| No IDOR vulnerabilities — no mass assignment of sensitive fields | — | ✅ Good |

**Recommendation:** None.

---

### 4. API Security (CORS/Headers) — **MEDIUM RISK** ⚠️

| Finding | Severity | Detail |
|---------|----------|--------|
| CSP disabled at HTTP layer | **High** | `contentSecurityPolicy: false` in helmet config ([server.js](fabric/backend/server.js#L51)) |
| CORS wildcard possible | **Medium** | If `CORS_ORIGIN=*` env var is set, any origin is allowed with `credentials: true` ([server.js](fabric/backend/server.js#L61)) |
| Electron CSP properly configured | — | ✅ Production Electron app has strict CSP |
| Helmet headers (HSTS, referrer-policy) enabled | — | ✅ Good |
| Request ID tracing on all requests | — | ✅ Good |
| Pagination ceiling (max 500) prevents DoS | — | ✅ Good |

**Remediation:**
1. **Enable CSP** at HTTP layer — even a permissive policy is better than none for dev mode:
   ```js
   contentSecurityPolicy: {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "blob:"],
     }
   }
   ```
```

