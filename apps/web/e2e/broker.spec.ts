import { test, expect } from '@playwright/test';

test.describe('Broker flows', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.TEST_BROKER_EMAIL, 'TEST_BROKER_EMAIL not set — skipping broker E2E');
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_BROKER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_BROKER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/broker', { timeout: 10000 });
  });

  test('broker dashboard loads', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('broker can navigate to loads page', async ({ page }) => {
    await page.goto('/broker/loads');
    await expect(page).toHaveURL('/broker/loads');
  });

  test('post load button is visible', async ({ page }) => {
    await page.goto('/broker/loads');
    const btn = page.locator(
      'button:has-text("Post Load"), button:has-text("New Load"), button:has-text("Post")',
    );
    await expect(btn.first()).toBeVisible({ timeout: 5000 });
  });

  test('loads page shows load cards or empty state', async ({ page }) => {
    await page.goto('/broker/loads');
    const content = page.locator(
      '[data-testid=load-card], text=/no loads/i, text=/empty/i, text=/post your first/i',
    );
    await expect(content.first()).toBeVisible({ timeout: 8000 });
  });

  test('messages page is accessible', async ({ page }) => {
    await page.goto('/messages');
    await expect(page).toHaveURL('/messages');
  });

  test('profile page is accessible', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
  });
});
