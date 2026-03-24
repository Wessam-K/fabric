# Phase 1 — Flow Map (Major Business Flows)

## 1. Boot/Startup Flow
- **Trigger**: `node server.js`
- **Sequence**: dotenv → Express init → Helmet/CORS/JSON → sanitizer → rate limiter → database.js (migrations v1-v26) → mount 33 route modules → generateNotifications() → listen on PORT
- **Failure Points**: DB migration errors halt startup; missing .env uses defaults
- **Test Status**: Covered by API test suite (starts server)

## 2. Authentication Flow
- **Trigger**: POST `/api/auth/login`
- **Preconditions**: Active user account, not locked
- **Sequence**: Rate limit check → find user by username → check lockout (5 fails/15 min) → bcrypt compare → generate JWT (24h) → reset fail count → return token + user
- **Failure Points**: Lockout after 5 failures, expired tokens, stale role in JWT
- **Test Status**: ✅ Covered (login, auth header, 401 tests)
- **Known Issue**: JWT embeds role — role change requires re-login (24h window)

## 3. Work Order Lifecycle
- **Trigger**: POST `/api/work-orders`
- **Sequence**: Create WO → Add sizes → Add fabric batches → Add accessories → Add stages from templates → Track stage movement → Record QC → Consume fabric → Calculate cost → Invoice → Complete
- **States**: draft → pending → in_progress → completed / cancelled
- **Failure Points**: Stage movement validation, fabric consumption > available, cost recalculation consistency
- **Test Status**: ✅ Covered (CRUD, cost calc, stages)

## 4. Purchase Order to Receipt Flow
- **Trigger**: POST `/api/purchase-orders`
- **Sequence**: Create PO → Send to supplier → Receive items (partial/full) → Create fabric/accessory batches → Record variance → Auto-journal entry → Payment
- **States**: draft → sent → partial → received / cancelled
- **Failure Points**: Over-receipt (>110%), variance tracking, batch creation
- **Test Status**: ✅ Covered (CRUD, status transitions)

## 5. Invoice Flow
- **Trigger**: POST `/api/invoices`
- **Sequence**: Create invoice → Add items → Calculate subtotal/tax/total → Send → Track payment → Auto-journal → Mark paid
- **States**: draft → sent → partial → paid / cancelled
- **Failure Points**: Negative totals (discount > subtotal), tax mismatch with auto-journal
- **Test Status**: ✅ Covered (CRUD)

## 6. MRP Planning Flow
- **Trigger**: POST `/api/mrp/calculate`
- **Sequence**: Collect active WOs → Calculate fabric/accessory needs → Check on-hand stock → Check on-order → Calculate shortages → Generate suggestions → Optional auto-PO
- **Failure Points**: Double-counting on-order (FIXED in R8), stale WO data
- **Test Status**: Not directly covered by unit tests

## 7. HR/Payroll Flow
- **Trigger**: POST `/api/hr/attendance/clock`
- **Sequence**: Employee clock-in/out → Attendance records → Payroll period → Calculate: base salary + overtime + bonuses - deductions - loans → Generate payslips
- **Failure Points**: Overtime multiplier not applied (Needs Product Confirmation), no max hours validation
- **Test Status**: ✅ Covered (employee CRUD, attendance)

## 8. Quotation → Sales Order → Work Order
- **Trigger**: POST `/api/quotations`
- **Sequence**: Create quotation → Approve → Convert to Sales Order (transaction) → Convert to Work Order (transaction) → Track production
- **Failure Points**: SO status validation, orphaned records (FIXED in R7 — transactions)
- **Test Status**: ✅ Partially covered

## 9. Returns Flow
- **Trigger**: POST `/api/returns/sales` or `/api/returns/purchase`
- **Sequence**: Create return → Process items → Update stock → Create credit note
- **States**: pending → approved → completed / rejected
- **Test Status**: Not directly covered

## 10. Accounting Flow
- **Trigger**: POST `/api/auto-journal/invoice/:id`
- **Sequence**: Manual or auto journal entry → Validate debit=credit → Save as draft → Post → Trial balance
- **Failure Points**: Tax mismatch between invoice and journal (FIXED in R8)
- **Test Status**: Not directly covered

## Unverified Flows
- File upload/download (Multer processing)
- Backup/restore end-to-end
- Notification generation cycle
- Excel import/export round-trip
- Barcode scanning flow
