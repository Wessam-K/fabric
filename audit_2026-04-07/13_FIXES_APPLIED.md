# Fixes Applied During This Audit

## Code Fixes

| # | File | Change | Severity | Status |
|---|---|---|---|---|
| 1 | `backend/server.js:523` | Removed `app.delete('/api/webhooks/:id')` — bypassed DELETE-blocking middleware | CRITICAL | ✅ Applied |
| 2 | `backend/routes/auth.js:48-51` | Replaced `{ requires_2fa: true, user_id }` with `{ requires_2fa: true, tfa_token }` using short-lived JWT | HIGH | ✅ Applied |
| 3 | `backend/middleware/auth.js:94` | Added `{ algorithms: ['HS256'] }` to `jwt.verify()` | HIGH | ✅ Applied |
| 4 | `backend/middleware/auth.js:55` | Added `{ algorithm: 'HS256' }` to `jwt.sign()` in generateToken | HIGH | ✅ Applied |
| 5 | `backend/routes/auth.js:3` | Added `JWT_SECRET` import from middleware/auth | HIGH | ✅ Applied |

## Database Migration — V55

| # | Change | Tables Affected |
|---|---|---|
| 6 | Seeded `inventory:edit` permission definition | permission_definitions |
| 7 | Added `inventory:edit` role_permissions for superadmin, manager | role_permissions |
| 8 | Seeded `reports:create/edit/delete` permission definitions | permission_definitions |
| 9 | Added `reports:create/edit/delete` role_permissions for superadmin, manager | role_permissions |
| 10 | Seeded `accounting` role_permissions (V14 silently failed) | role_permissions |
| 11 | Added `accounting:view` for viewer role | role_permissions |

## Frontend Fixes (from prior session, completed this audit)

| # | File | Change |
|---|---|---|
| 12 | `Scheduling.jsx` | Removed Trash2, deleteEntry, delete button |
| 13 | `Settings.jsx` | Removed Trash2, deleteStage, delete button |
| 14 | `StageTemplates.jsx` | Removed Trash2, deleteId, handleDelete, delete button, ConfirmDialog |
| 15 | `MRP.jsx` | Removed Trash2, cancelRun, cancel button |
| 16 | `Backups.jsx` | Removed Trash2, remove function, delete button |
| 17 | `Quotations.jsx` | Removed unused Trash2 import |
| 18 | `BomTemplates.jsx` | Fixed orphaned confirm delete modal, missing `</div>` |
