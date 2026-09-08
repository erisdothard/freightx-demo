import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['html']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  // Serve the app in both modes. CI previously set this to `undefined` and relied
  // on the workflow to start something on PLAYWRIGHT_BASE_URL — and the workflow
  // never did, so every test in every project hit a dead port. That is the whole
  // reason this job has never once passed.
  //
  // CI previews the production build the `Build web (for E2E)` step just produced,
  // which is also the artefact worth testing. `strictPort` makes a port clash fail
  // loudly instead of serving on 4174 while the tests keep knocking on 4173.
  webServer: process.env.CI
    ? {
        command: 'pnpm preview --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: 'pnpm dev',
        port: 5173,
        reuseExistingServer: true,
      },
});
