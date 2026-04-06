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

// ── Step 1: Login once and save auth state ────────────────────────────────────
test.describe('00 — Auth Setup', () => {
  test('login screenshots + save auth state', async ({ page }) => {
    // Screenshot login page
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '01-login-page');

    // Invalid login attempt
    await page.getByPlaceholder('ahmed.manager').fill('admin');
    await page.getByPlaceholder('••••••••').fill('wrongpass');
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await page.waitForTimeout(1500);
    await snap(page, '01-login-error');

    // Valid login
    await page.getByPlaceholder('ahmed.manager').fill('admin');
    await page.getByPlaceholder('••••••••').fill('123456');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await page.waitForURL(/dashboard|change-password/, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '01-login-success-dashboard');

    // Save auth for all subsequent tests
    await page.context().storageState({ path: AUTH_FILE });
  });
});

// ── Step 2: All pages using saved auth ────────────────────────────────────────
test.describe('All Pages', () => {
  test.use({ storageState: AUTH_FILE });

  test('02 dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '02-dashboard-overview');
  });

  test('03a models list', async ({ page }) => {
    await page.goto('/models');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '03-models-list');
  });

  test('03b model create form', async ({ page }) => {
    await page.goto('/models/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '03-model-create-form');
  });

  test('03c model edit DRS-001', async ({ page }) => {
    await page.goto('/models/DRS-001/edit');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '03-model-edit-DRS001');
  });

  test('04 BOM templates', async ({ page }) => {
    await page.goto('/models/DRS-001/bom');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '04-bom-templates-DRS001');
  });

  test('05a fabrics list', async ({ page }) => {
    await page.goto('/fabrics');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '05-fabrics-list');
  });

  test('05b fabric inventory', async ({ page }) => {
    await page.goto('/inventory/fabrics');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '05-fabric-inventory');
  });

  test('06 accessories', async ({ page }) => {
    await page.goto('/accessories');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '06-accessories-list');
  });

  test('07 suppliers', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '07-suppliers-list');
  });

  test('08 purchase orders', async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '08-purchase-orders-list');
  });

  test('09a work orders list', async ({ page }) => {
    await page.goto('/work-orders');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '09-work-orders-list');
  });

  test('09b work order create', async ({ page }) => {
    await page.goto('/work-orders/new');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '09-work-order-create');
  });

  test('09c work order detail (in-progress showcase)', async ({ page }) => {
    // Navigate to showcase WO: عباية سوداء - إنتاج كبير (200 pcs, stages: 100 in sewing, 50 ironing)
    await page.goto('/work-orders');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Find the showcase WO by searching
    const searchInput = page.locator('input[placeholder*="بحث"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('عباية سوداء');
      await page.waitForTimeout(1000);
    }
    await snap(page, '09-work-order-showcase-search');
    
    // Open the first in_progress showcase WO
    await page.goto('/work-orders/76');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await snap(page, '09-work-order-detail-inprogress');
  });

  test('09d work order detail (completed)', async ({ page }) => {
    // Navigate to completed showcase WO: يونيفورم مدرسي (500 pcs, all stages completed)
    await page.goto('/work-orders/80');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await snap(page, '09-work-order-detail-completed');
  });

  test('09e work order stages progress', async ({ page }) => {
    // تيشيرت قطن - 300 pieces, almost done, QC in progress
    await page.goto('/work-orders/77');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await snap(page, '09-work-order-near-complete');
  });

  test('09f work order early stage', async ({ page }) => {
    // فستان سواريه - 80 pieces, only in cutting
    await page.goto('/work-orders/78');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await snap(page, '09-work-order-early-stage');
  });

  test('10 customers', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '10-customers-list');
  });

  test('11a invoices list', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '11-invoices-list');
  });

  test('11b invoice view', async ({ page }) => {
    await page.goto('/invoices/1/view');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '11-invoice-view-INV001');
  });

  test('12 employees', async ({ page }) => {
    await page.goto('/hr/employees');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '12-hr-employees-list');
  });

  test('13 attendance', async ({ page }) => {
    await page.goto('/hr/attendance');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '13-hr-attendance');
  });

  test('14 payroll', async ({ page }) => {
    await page.goto('/hr/payroll');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '14-hr-payroll');
  });

  test('15 machines', async ({ page }) => {
    await page.goto('/machines');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '15-machines-list');
  });

  test('16 users', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '16-users-management');
  });

  test('17 settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '17-settings');
  });

  test('18 audit log', async ({ page }) => {
    await page.goto('/audit-log');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '18-audit-log');
  });

  test('19 reports', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '19-reports-dashboard');
  });

  test('20 exports center', async ({ page }) => {
    await page.goto('/exports');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await snap(page, '20-exports-center');
  });

  test('21 quotations', async ({ page }) => {
    await page.goto('/quotations');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '21-quotations-list');
  });

  test('22 sales orders', async ({ page }) => {
    await page.goto('/sales-orders');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '22-sales-orders-list');
  });

  test('23 shipments', async ({ page }) => {
    await page.goto('/shipments');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '23-shipments-list');
  });

  test('24 accessory inventory', async ({ page }) => {
    await page.goto('/inventory/accessories');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '24-accessory-inventory');
  });

  test('25 journal entries', async ({ page }) => {
    await page.goto('/journal-entries');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '25-journal-entries');
  });

  test('26 chart of accounts', async ({ page }) => {
    await page.goto('/chart-of-accounts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '26-chart-of-accounts');
  });

  test('27 maintenance orders', async ({ page }) => {
    await page.goto('/maintenance');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '27-maintenance-orders');
  });

  test('28 leave requests', async ({ page }) => {
    await page.goto('/hr/leaves');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '28-leave-requests');
  });

  test('29 quality control', async ({ page }) => {
    await page.goto('/quality');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await snap(page, '29-quality-control');
  });
});
