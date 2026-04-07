# Orphaned Code Audit

## Summary

| Category | Count |
|---|---|
| Orphaned route files | **0** |
| Orphaned frontend pages | **1** |
| Orphaned components | **9** |
| Orphaned backend utils | **1** |
| Dead imports in server.js | **1** |
| TODO/FIXME/HACK markers | **1** |
| Large commented-out blocks | **2** |

---

## Orphaned Frontend Page

### `frontend/src/pages/SalesOrders.jsx`
Not imported in `App.jsx`. No route defined. Completely unreachable. Either wire into routing or remove.

---

## Orphaned Frontend Components (9)

### Top-level components (7):
| Component | Notes |
|---|---|
| `BarcodeScanner.jsx` | Never imported by any page |
| `BomTemplateLoader.jsx` | Never imported |
| `BomVariantTabs.jsx` | Never imported |
| `DashboardWidgets.jsx` | Never imported (has imports from ui) |
| `PriorityBadge.jsx` | Never imported |
| `SupplierSelect.jsx` | Never imported |
| `UpgradePrompt.jsx` | Never imported |

### UI Components (2):
| Component | Notes |
|---|---|
| `DataTable.jsx` | Exported from barrel but never used |
| `FormSection.jsx` | Exports FormSection, FormRow, FormField — none used |

**Note:** Vite tree-shaking excludes unused lazy imports, so these don't bloat the production bundle. But they add to codebase noise and maintenance burden.

---

## Orphaned Backend Code

### `backend/utils/apiResponse.js`
Not imported by any backend file. Dead utility.

### Dead import in `server.js`
`broadcast` is destructured from `utils/websocket` but never called in server.js. Only `initWebSocket` and `getClientCount` are used.

---

## TODO/FIXME/HACK Markers

Only **1** marker found in routes:
- `backend/routes/hr.js:716` — `HARDCODED` comment about fallback values for payroll calculation

---

## Recommendation

These 11 orphaned files are safe to remove. The SalesOrders page should be evaluated: if sales order functionality is needed, wire it into the router; otherwise, remove it.
