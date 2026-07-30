import { test, expect } from '@playwright/test';

test.describe('Carrier flows', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.TEST_CARRIER_EMAIL, 'TEST_CARRIER_EMAIL not set — skipping carrier E2E');
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_CARRIER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_CARRIER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/carrier', { timeout: 10000 });
  });

  test('carrier dashboard loads', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('carrier can navigate to load board', async ({ page }) => {
    await page.goto('/carrier/loads');
    await expect(page).toHaveURL('/carrier/loads');
  });

  test('carrier can navigate to fleet page', async ({ page }) => {
    await page.goto('/carrier/fleet');
    await expect(page).toHaveURL('/carrier/fleet');
  });

  test('post truck button is visible on fleet page', async ({ page }) => {
    await page.goto('/carrier/fleet');
    // Look for a post/add button
    const btn = page.locator(
      'button:has-text("Post"), button:has-text("Add Truck"), button:has-text("New Truck")',
    );
    await expect(btn.first()).toBeVisible({ timeout: 5000 });
  });

  test('load board shows at least one load card or empty state', async ({ page }) => {
    await page.goto('/carrier/loads');
    const content = page.locator('[data-testid=load-card], text=/no loads/i, text=/empty/i');
    await expect(content.first()).toBeVisible({ timeout: 8000 });
  });
});
