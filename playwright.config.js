// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:9173',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
