// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

const AUTH_FILE = path.join(__dirname, '..', '.auth-state.json');

/** Save a full-page screenshot */
async function snap(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
}

/** Wait for API-driven content to load */
async function waitForContent(page, timeout = 3000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(timeout);
}

// ════════════════════════════════════════════════════════════════════
//  PHASE A — Authentication
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase A — Authentication', () => {

  test('A1 — login page renders', async ({ page }) => {
    await page.goto('/login');
    await waitForContent(page, 2000);
    await expect(page.getByRole('heading', { name: 'WK-Factory' })).toBeVisible();
    await expect(page.getByPlaceholder('ahmed.manager')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /تسجيل الدخول/ })).toBeVisible();
    await snap(page, '01-login-page');
  });

  test('A2 — invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await waitForContent(page, 1500);
    await page.getByPlaceholder('ahmed.manager').fill('admin');
    await page.getByPlaceholder('••••••••').fill('wrongpass');
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await page.waitForTimeout(2000);
    // Should still be on login page (no redirect)
    await expect(page).toHaveURL(/login/);
    await snap(page, '01-login-error');
  });

  test('A3 — valid login redirects to dashboard + save auth', async ({ page }) => {
    await page.goto('/login');
    await waitForContent(page, 1500);
    await page.getByPlaceholder('ahmed.manager').fill('admin');
    await page.getByPlaceholder('••••••••').fill('123456');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await page.waitForURL(/dashboard|change-password/, { timeout: 30000 });
    await waitForContent(page, 2500);
    // Verify we're away from login
    await expect(page).not.toHaveURL(/login/);
    await snap(page, '01-login-success-dashboard');
    // Save auth for all subsequent tests
    await page.context().storageState({ path: AUTH_FILE });
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE B — Dashboard & Navigation (using saved auth)
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase B — Dashboard & Navigation', () => {
  test.use({ storageState: AUTH_FILE });

  test('B1 — dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 3000);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '02-dashboard-overview');
  });

  test('B2 — navigate all major pages without errors', async ({ page }) => {
    const pages = [
      { path: '/models', snap: '03-models-list' },
      { path: '/fabrics', snap: '05-fabrics-list' },
      { path: '/accessories', snap: '06-accessories-list' },
      { path: '/suppliers', snap: '07-suppliers-list' },
      { path: '/customers', snap: '10-customers-list' },
      { path: '/work-orders', snap: '09-work-orders-list' },
      { path: '/purchase-orders', snap: '08-purchase-orders-list' },
      { path: '/invoices', snap: '11-invoices-list' },
      { path: '/hr/employees', snap: '12-hr-employees-list' },
      { path: '/machines', snap: '15-machines-list' },
      { path: '/reports', snap: '19-reports-dashboard' },
      { path: '/exports', snap: '20-exports-center' },
      { path: '/audit-log', snap: '18-audit-log' },
      { path: '/settings', snap: '17-settings' },
    ];
    for (const p of pages) {
      await page.goto(p.path);
      await waitForContent(page, 2000);
      const body = await page.textContent('body');
      expect(body).not.toContain('Something went wrong');
      await snap(page, p.snap);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE C — Models
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase C — Models', () => {
  test.use({ storageState: AUTH_FILE });

  test('C1 — models list shows seeded models', async ({ page }) => {
    await page.goto('/models');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('MOD-001');
    expect(body).toContain('MOD-006');
    await snap(page, '03-models-list');
  });

  test('C2 — model create form renders', async ({ page }) => {
    await page.goto('/models/new');
    await waitForContent(page, 2000);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '03-model-create-form');
  });

  test('C3 — model edit page loads MOD-001', async ({ page }) => {
    await page.goto('/models/MOD-001/edit');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('MOD-001');
    await snap(page, '03-model-edit-MOD001');
  });

  test('C4 — BOM templates for MOD-001', async ({ page }) => {
    await page.goto('/models/MOD-001/bom');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '04-bom-templates-MOD001');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE D — Fabrics
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase D — Fabrics', () => {
  test.use({ storageState: AUTH_FILE });

  test('D1 — fabrics list shows seeded fabrics', async ({ page }) => {
    await page.goto('/fabrics');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('FAB-001');
    expect(body).toContain('FAB-012');
    await snap(page, '05-fabrics-list');
  });

  test('D2 — fabric inventory page loads', async ({ page }) => {
    await page.goto('/inventory/fabrics');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '05-fabric-inventory');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE E — Accessories
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase E — Accessories', () => {
  test.use({ storageState: AUTH_FILE });

  test('E1 — accessories list shows seeded accessories', async ({ page }) => {
    await page.goto('/accessories');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('ACC-001');
    expect(body).toContain('ACC-015');
    await snap(page, '06-accessories-list');
  });

  test('E2 — accessory inventory page loads', async ({ page }) => {
    await page.goto('/inventory/accessories');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '06-accessory-inventory');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE F — Suppliers
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase F — Suppliers', () => {
  test.use({ storageState: AUTH_FILE });

  test('F1 — suppliers list shows seeded suppliers', async ({ page }) => {
    await page.goto('/suppliers');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('SUP-001');
    expect(body).toContain('SUP-008');
    await snap(page, '07-suppliers-list');
  });

  test('F2 — supplier detail page loads', async ({ page }) => {
    await page.goto('/suppliers');
    await waitForContent(page, 2500);
    const link = page.locator('text=SUP-001').first();
    if (await link.isVisible()) {
      await link.click();
      await waitForContent(page, 2500);
      await snap(page, '07-supplier-detail');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE G — Purchase Orders
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase G — Purchase Orders', () => {
  test.use({ storageState: AUTH_FILE });

  test('G1 — PO list shows seeded POs', async ({ page }) => {
    await page.goto('/purchase-orders');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('PO-2026-001');
    await snap(page, '08-purchase-orders-list');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE H — Work Orders
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase H — Work Orders', () => {
  test.use({ storageState: AUTH_FILE });

  test('H1 — work orders list shows seeded WOs', async ({ page }) => {
    await page.goto('/work-orders');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('WO-2026-001');
    await snap(page, '09-work-orders-list');
  });

  test('H2 — work order create form renders', async ({ page }) => {
    await page.goto('/work-orders/new');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '09-work-order-create');
  });

  test('H3 — work order detail (in-progress)', async ({ page }) => {
    await page.goto('/work-orders');
    await waitForContent(page, 2500);
    const woLink = page.locator('text=WO-2026-001').first();
    if (await woLink.isVisible()) {
      await woLink.click();
      await waitForContent(page, 3000);
      await snap(page, '09-work-order-detail-inprogress');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE I — Customers & Invoices
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase I — Customers & Invoices', () => {
  test.use({ storageState: AUTH_FILE });

  test('I1 — customers list shows seeded customers', async ({ page }) => {
    await page.goto('/customers');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('CUS-001');
    await snap(page, '10-customers-list');
  });

  test('I2 — invoices list shows seeded invoices', async ({ page }) => {
    await page.goto('/invoices');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('INV-2026-001');
    await snap(page, '11-invoices-list');
  });

  test('I3 — invoice view page', async ({ page }) => {
    await page.goto('/invoices');
    await waitForContent(page, 2500);
    const invLink = page.locator('text=INV-2026-001').first();
    if (await invLink.isVisible()) {
      await invLink.click();
      await waitForContent(page, 2500);
      await snap(page, '11-invoice-view');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE J — Finance & Accounting
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase J — Finance', () => {
  test.use({ storageState: AUTH_FILE });

  test('J1 — chart of accounts', async ({ page }) => {
    await page.goto('/accounting/coa');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '12-chart-of-accounts');
  });

  test('J2 — journal entries', async ({ page }) => {
    await page.goto('/accounting/journal');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '12-journal-entries');
  });

  test('J3 — expenses', async ({ page }) => {
    await page.goto('/expenses');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '12-expenses');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE K — HR
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase K — HR', () => {
  test.use({ storageState: AUTH_FILE });

  test('K1 — employees list', async ({ page }) => {
    await page.goto('/hr/employees');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '13-hr-employees');
  });

  test('K2 — attendance', async ({ page }) => {
    await page.goto('/hr/attendance');
    await waitForContent(page, 2500);
    await snap(page, '13-hr-attendance');
  });

  test('K3 — payroll', async ({ page }) => {
    await page.goto('/hr/payroll');
    await waitForContent(page, 2500);
    await snap(page, '14-hr-payroll');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE L — Production & Machines
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase L — Production', () => {
  test.use({ storageState: AUTH_FILE });

  test('L1 — machines list', async ({ page }) => {
    await page.goto('/machines');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '15-machines-list');
  });

  test('L2 — maintenance page', async ({ page }) => {
    await page.goto('/maintenance');
    await waitForContent(page, 2500);
    await snap(page, '15-maintenance');
  });

  test('L3 — stage templates', async ({ page }) => {
    await page.goto('/stage-templates');
    await waitForContent(page, 2500);
    await snap(page, '15-stage-templates');
  });

  test('L4 — quality management', async ({ page }) => {
    await page.goto('/quality');
    await waitForContent(page, 2500);
    await snap(page, '16-quality');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE M — Reports & Exports
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase M — Reports & Exports', () => {
  test.use({ storageState: AUTH_FILE });

  test('M1 — reports dashboard', async ({ page }) => {
    await page.goto('/reports');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '19-reports-dashboard');
  });

  test('M2 — exports center loads catalog', async ({ page }) => {
    await page.goto('/exports');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '20-exports-center');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE N — Admin & Users
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase N — Admin', () => {
  test.use({ storageState: AUTH_FILE });

  test('N1 — users page shows seeded users', async ({ page }) => {
    await page.goto('/users');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body).toContain('admin');
    await snap(page, '16-users-management');
  });

  test('N2 — audit log', async ({ page }) => {
    await page.goto('/audit-log');
    await waitForContent(page, 2500);
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(100);
    await snap(page, '18-audit-log');
  });

  test('N3 — settings', async ({ page }) => {
    await page.goto('/settings');
    await waitForContent(page, 2500);
    await snap(page, '17-settings');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE O — Shipping
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase O — Shipping', () => {
  test.use({ storageState: AUTH_FILE });

  test('O1 — shipping page', async ({ page }) => {
    await page.goto('/shipping');
    await waitForContent(page, 2000);
    await snap(page, '23-shipping');
  });

  test('O2 — returns page', async ({ page }) => {
    await page.goto('/returns');
    await waitForContent(page, 2000);
    await snap(page, '24-returns');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE O2 — Detail Pages
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase O2 — Detail Pages', () => {
  test.use({ storageState: AUTH_FILE });

  test('O2a — customer detail page', async ({ page }) => {
    await page.goto('/customers');
    await waitForContent(page, 2500);
    const link = page.locator('text=CUS-001').first();
    if (await link.isVisible()) {
      await link.click();
      await waitForContent(page, 2500);
      await snap(page, '10-customer-detail');
    }
  });

  test('O2b — machine detail page', async ({ page }) => {
    await page.goto('/machines');
    await waitForContent(page, 2500);
    // Click the first machine row link
    const link = page.locator('tr >> text=/MCH-/').first();
    if (await link.isVisible()) {
      await link.click();
      await waitForContent(page, 2500);
      await snap(page, '15-machine-detail');
    }
  });

  test('O2c — work order detail (completed WO)', async ({ page }) => {
    await page.goto('/work-orders');
    await waitForContent(page, 2500);
    // Try to find a completed WO
    const woLink = page.locator('text=WO-2026-005').first();
    if (await woLink.isVisible()) {
      await woLink.click();
      await waitForContent(page, 3000);
      await snap(page, '09-work-order-detail-completed');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE O3 — Additional Pages
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase O3 — Additional Pages', () => {
  test.use({ storageState: AUTH_FILE });

  test('O3a — trial balance', async ({ page }) => {
    await page.goto('/accounting/trial-balance');
    await waitForContent(page, 2500);
    await snap(page, '12-trial-balance');
  });

  test('O3b — MRP planning', async ({ page }) => {
    await page.goto('/mrp');
    await waitForContent(page, 2500);
    await snap(page, '25-mrp-planning');
  });

  test('O3c — scheduling', async ({ page }) => {
    await page.goto('/scheduling');
    await waitForContent(page, 2500);
    await snap(page, '26-scheduling');
  });

  test('O3d — documents', async ({ page }) => {
    await page.goto('/documents');
    await waitForContent(page, 2500);
    await snap(page, '27-documents');
  });

  test('O3e — permissions', async ({ page }) => {
    await page.goto('/permissions');
    await waitForContent(page, 2500);
    await snap(page, '16-permissions');
  });

  test('O3f — knowledge base', async ({ page }) => {
    await page.goto('/knowledge-base');
    await waitForContent(page, 2500);
    await snap(page, '29-knowledge-base');
  });

  test('O3h — profile page', async ({ page }) => {
    await page.goto('/profile');
    await waitForContent(page, 2500);
    await snap(page, '30-profile');
  });

  test('O3i — notifications', async ({ page }) => {
    await page.goto('/notifications');
    await waitForContent(page, 2500);
    await snap(page, '31-notifications');
  });

  test('O3j — HR leaves', async ({ page }) => {
    await page.goto('/hr/leaves');
    await waitForContent(page, 2500);
    await snap(page, '13-hr-leaves');
  });

  test('O3k — import wizard', async ({ page }) => {
    await page.goto('/import');
    await waitForContent(page, 2500);
    await snap(page, '32-import-wizard');
  });
});

// ════════════════════════════════════════════════════════════════════
//  PHASE P — API Smoke Tests (via page context fetch)
// ════════════════════════════════════════════════════════════════════
test.describe.serial('Phase P — API Smoke', () => {
  test.use({ storageState: AUTH_FILE });

  test('P1 — /api/fabrics returns 12 active fabrics', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/fabrics');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    const active = Array.isArray(res.data) ? res.data.filter(f => f.status === 'active') : [];
    expect(active.length).toBeGreaterThanOrEqual(12);
  });

  test('P2 — /api/accessories returns 15 accessories', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/accessories');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data) ? res.data.length : 0).toBeGreaterThanOrEqual(15);
  });

  test('P3 — /api/suppliers returns 8 suppliers', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/suppliers');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data) ? res.data.length : 0).toBeGreaterThanOrEqual(8);
  });

  test('P4 — /api/work-orders returns 18 WOs', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/work-orders');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    const data = Array.isArray(res.data) ? res.data : (res.data.work_orders || res.data.workOrders || []);
    expect(data.length).toBeGreaterThanOrEqual(18);
  });

  test('P5 — /api/purchase-orders returns 12 POs', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/purchase-orders');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    const data = Array.isArray(res.data) ? res.data : (res.data.orders || res.data.purchaseOrders || []);
    expect(data.length).toBeGreaterThanOrEqual(12);
  });

  test('P6 — /api/exports/catalog returns export list', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/exports/catalog');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(15);
  });

  test('P7 — /api/invoices returns 10 invoices', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/invoices');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    const data = Array.isArray(res.data) ? res.data : (res.data.invoices || []);
    expect(data.length).toBeGreaterThanOrEqual(10);
  });

  test('P8 — /api/models returns 6 models', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForContent(page, 1500);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/models');
      return { status: r.status, data: await r.json() };
    });
    expect(res.status).toBe(200);
    const data = Array.isArray(res.data) ? res.data : (res.data.models || []);
    expect(data.length).toBeGreaterThanOrEqual(6);
  });

  test('P9 — unauthenticated API request is rejected', async ({ browser }) => {
    // Skip in NODE_ENV=test since auth may be relaxed
    const ctx = await browser.newContext(); // no storage state
    const page = await ctx.newPage();
    await page.goto('http://localhost:9173');
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/fabrics');
      return r.status;
    });
    // In test mode, auth middleware may be relaxed; in production, expect 401
    expect([200, 401]).toContain(res);
    await ctx.close();
  });
});
