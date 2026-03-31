const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    bypassCSP: true,
  });
  const page = await context.newPage();

  const allMsgs = [];
  page.on('console', msg => allMsgs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => allMsgs.push({ type: 'pageerror', text: err.message + '\n' + err.stack }));

  await page.addInitScript(() => { localStorage.clear(); });

  await page.goto('http://localhost:9173/login');
  await page.waitForTimeout(2000);

  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch (e) {
    console.log('Did not reach dashboard:', e.message);
  }

  await page.waitForTimeout(8000);

  // Scroll down
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Check for error boundary text
  const errorTexts = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const found = [];
    for (const el of all) {
      if (el.children.length === 0) {
        const t = el.textContent.trim();
        if (t.includes('\u062E\u0637\u0623') || t.includes('error') || t.includes('Error')) {
          found.push(t.substring(0, 200));
        }
      }
    }
    return found;
  });

  console.log('Error texts found:', JSON.stringify(errorTexts, null, 2));

  const errors = allMsgs.filter(m => m.type === 'error' || m.type === 'pageerror');
  console.log('\nConsole errors:', errors.length);
  errors.forEach((e, i) => console.log(`[${i}]`, e.text.substring(0, 800)));

  await page.screenshot({ path: 'tools/dashboard-debug.png', fullPage: true });
  console.log('\nScreenshot saved');

  await browser.close();
})();
