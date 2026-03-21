const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function snap(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in...');
  await page.goto('http://localhost:9173/login');
  await page.waitForLoadState('networkidle');

  // Check what screenshots are missing
  const needed = ['17-settings', '18-audit-log', '19-reports-dashboard'];
  const missing = needed.filter(n => !fs.existsSync(path.join(SCREENSHOTS, `${n}.png`)));
  
  if (missing.length === 0) {
    console.log('All screenshots already exist!');
    await browser.close();
    return;
  }

  console.log(`Missing: ${missing.join(', ')}`);

  // Login
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  console.log('Logged in!');

  for (const name of missing) {
    const route = name === '17-settings' ? '/settings' :
                  name === '18-audit-log' ? '/audit-log' :
                  name === '19-reports-dashboard' ? '/reports' : null;
    if (route) {
      await page.goto(`http://localhost:9173${route}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await snap(page, name);
    }
  }

  // Also capture any other missing from the full list
  const allScreenshots = [
    '01-login-page', '01-login-error', '01-login-success-dashboard',
    '02-dashboard-overview',
    '03-models-list', '03-model-create-form', '03-model-edit-DRS001',
    '04-bom-templates-DRS001',
    '05-fabrics-list', '05-fabric-inventory',
    '06-accessories-list', '07-suppliers-list', '08-purchase-orders-list',
    '09-work-orders-list', '09-work-order-create', '09-work-order-detail-inprogress', '09-work-order-detail-completed',
    '10-customers-list', '11-invoices-list', '11-invoice-view-INV001',
    '12-hr-employees-list', '13-hr-attendance', '14-hr-payroll',
    '15-machines-list', '16-users-management',
    '17-settings', '18-audit-log', '19-reports-dashboard'
  ];

  const routes = {
    '02-dashboard-overview': '/dashboard',
    '03-models-list': '/models', '03-model-create-form': '/models/new', '03-model-edit-DRS001': '/models/DRS-001/edit',
    '04-bom-templates-DRS001': '/models/DRS-001/bom',
    '05-fabrics-list': '/fabrics', '05-fabric-inventory': '/inventory/fabrics',
    '06-accessories-list': '/accessories', '07-suppliers-list': '/suppliers',
    '08-purchase-orders-list': '/purchase-orders',
    '09-work-orders-list': '/work-orders', '09-work-order-create': '/work-orders/new',
    '09-work-order-detail-inprogress': '/work-orders/1', '09-work-order-detail-completed': '/work-orders/3',
    '10-customers-list': '/customers',
    '11-invoices-list': '/invoices', '11-invoice-view-INV001': '/invoices/1/view',
    '12-hr-employees-list': '/hr/employees', '13-hr-attendance': '/hr/attendance', '14-hr-payroll': '/hr/payroll',
    '15-machines-list': '/machines', '16-users-management': '/users',
    '17-settings': '/settings', '18-audit-log': '/audit-log', '19-reports-dashboard': '/reports',
  };

  // Only capture what's still missing
  const stillMissing = allScreenshots.filter(n => !fs.existsSync(path.join(SCREENSHOTS, `${n}.png`)) && routes[n]);
  if (stillMissing.length > 0) {
    console.log(`\nStill missing: ${stillMissing.join(', ')}`);
    for (const name of stillMissing) {
      await page.goto(`http://localhost:9173${routes[name]}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await snap(page, name);
    }
  }

  console.log(`\nTotal screenshots: ${allScreenshots.filter(n => fs.existsSync(path.join(SCREENSHOTS, `${n}.png`))).length}/${allScreenshots.length}`);
  await browser.close();
  console.log('Done!');
})();
