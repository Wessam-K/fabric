# Permissions & Roles Audit

## System Architecture

**Three-layer permission model:**
1. **Role-based** (`role_permissions` table) — default permissions per role
2. **User-override** (`user_permissions` table) — per-user overrides on top of role defaults
3. **Superadmin bypass** — hardcoded: superadmin always returns `true`

**Middleware chain:** `requireAuth` → `requirePermission(module, action)` → `canUser()` → check role_permissions + user_permissions (60s cache)

---

## Roles

| Role | Arabic Label | Description |
|---|---|---|
| `superadmin` | مدير النظام | Full system access (bypasses all permission checks) |
| `manager` | مدير | Full access to most modules |
| `accountant` | محاسب | Financial modules + read-only for others |
| `production` | إنتاج | Production, machines, quality, scheduling, MRP |
| `hr` | موارد بشرية | HR, payroll, and employee management |
| `viewer` | مشاهد | Read-only access to most modules |

---

## Permission Modules (26 modules, ~80 permissions)

| Module | Actions | Seeded in | Role Permissions Seeded |
|---|---|---|---|
| dashboard | view | V6 (base) | ✅ All roles |
| models | view, create, edit, delete | V6 | ✅ |
| fabrics | view, create, edit, delete | V6 | ✅ |
| accessories | view, create, edit, delete | V6 | ✅ |
| work_orders | view, create, edit, delete | V6 | ✅ |
| invoices | view, create, edit, delete | V6 | ✅ |
| suppliers | view, create, edit, delete | V6 | ✅ |
| purchase_orders | view, create, edit, delete | V6 | ✅ |
| inventory | view | V6 | ✅ |
| inventory | edit | **V55 (audit fix)** | ✅ superadmin, manager |
| reports | view, export | V6 | ✅ |
| reports | create, edit, delete | **V55 (audit fix)** | ✅ superadmin, manager |
| hr | view, create, edit, delete | V6 | ✅ |
| payroll | view, manage | V6 | ✅ |
| users | view, create, edit, delete | V6 | ✅ |
| audit | view | V6 | ✅ |
| settings | view, edit | V6 | ✅ |
| settings | delete | V26 | ✅ superadmin, manager |
| customers | view, create, edit, delete | V10 | ✅ |
| machines | view, manage | V10 | ✅ |
| machines | create, edit, delete | V26 | ✅ |
| accounting | view, create, edit, post | V14 | **V55 (audit fix)** — V14 silently failed |
| expenses | view, create, edit, delete, approve | V16 | ✅ |
| maintenance | view, create, edit, delete | V16 | ✅ |
| mrp | view, create, edit, delete | V22 | ✅ |
| shipping | view, create, edit, delete | V22 | ✅ |
| scheduling | view, create, edit, delete | V22 | ✅ |
| quality | view, create, edit, delete | V22 | ✅ |
| quotations | view, create, edit, delete | V22 | ✅ |
| sales_orders | view, create, edit, delete | V22 | ✅ |
| samples | view, create, edit, delete | V22 | ✅ |
| returns | view, create, edit, delete | V22 | ✅ |
| documents | view, create, edit, delete | V22 | ✅ |
| backups | view, create, edit, delete | V22 | ✅ |

---

## Issues Found & Fixed

### FIXED — V55 Migration Added:

1. **`inventory:edit` not in permission_definitions** — Used by warehouse and transfer routes. Non-superadmin users were blocked from warehouse management. Fixed: seeded definition + role_permissions for superadmin, manager.

2. **`reports:create/edit/delete` not in permission_definitions** — Used by report-schedules.js. Non-superadmin couldn't manage report schedules. Fixed: seeded all three.

3. **`accounting` role_permissions never seeded** — V14 wrapped the role_permissions insertion in a try/catch that silently failed. Accountants couldn't access accounting module. Fixed: seeded for superadmin, manager, accountant + viewer:view.

### Open Issues:

4. **Inline role checks inconsistent** — `POST /api/license/activate`, `GET /api/monitoring`, admin endpoints, and webhook CRUD use `req.user.role !== 'superadmin'` inline checks instead of `requireRole('superadmin')` middleware. While functional, this is inconsistent with the permission architecture.

5. **Bulk role change self-assignment** — `POST /api/users/bulk` with `action=change_role` does not check if the requesting user is in the `ids` array. A superadmin could change their own role.

6. **Permission cache 60s TTL** — Revoked permissions stay active for up to 60 seconds after change. `invalidatePermCache()` is called on permission edits but the map isn't in shared memory across cluster workers.

---

## Route Protection Coverage

| Category | Count | Protection |
|---|---|---|
| Public endpoints (health, setup, auth) | 8 | None needed |
| Endpoints with `requirePermission` | 280+ | ✅ Full |
| Endpoints with `requireRole` only | 15 | ✅ Role-gated |
| Endpoints with inline role check | 8 | ⚠️ Functional but inconsistent |
| Endpoints with `requireAuth` only | 6 | ⚠️ Own-data only (safe) |
| **Total API endpoints** | **310+** | **99%+ protected** |

---

## Seed Default Users (Development Only)

| Username | Role | Password |
|---|---|---|
| admin | superadmin | `123456` |
| wessam | superadmin | `123456` |
| manager | manager | `123456` |
| viewer | viewer | `123456` |

> ⚠️ These passwords are weak development defaults. The `POST /api/setup/create-admin` flow requires minimum 10-char passwords for production setup.
