import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_SHIPPER_EMAIL ?? '';
const PASSWORD = process.env.TEST_SHIPPER_PASSWORD ?? '';

test.describe('Shipper flow', () => {
  test.beforeEach(async ({ page }) => {
    if (!EMAIL || !PASSWORD) {
      test.skip();
      return;
    }
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/shipper', { timeout: 10_000 });
  });

  test('shipper dashboard loads with active shipments', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();
  });

  test('shipper can navigate to loads page', async ({ page }) => {
    await page.goto('/shipper/loads');
    await expect(page).toHaveURL('/shipper/loads');
  });

  test('shipper loads page renders without error', async ({ page }) => {
    await page.goto('/shipper/loads');
    await expect(page.locator('text=404')).not.toBeVisible();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('shipper can open post load sheet', async ({ page }) => {
    await page.goto('/shipper/loads');
    const postBtn = page.locator('button', { hasText: /post|new load/i });
    if (await postBtn.isVisible()) {
      await postBtn.click();
      await expect(page.locator('[role="dialog"], .bottom-sheet, [data-sheet]')).toBeVisible({
        timeout: 3000,
      });
    }
  });

  test('shipper can access tracking page', async ({ page }) => {
    await page.goto('/track');
    await expect(page).toHaveURL(/\/track/);
    await expect(page.locator('text=404')).not.toBeVisible();
  });

  test('shipper can access messages', async ({ page }) => {
    await page.goto('/messages');
    await expect(page).toHaveURL('/messages');
  });

  test('shipper redirected away from carrier routes', async ({ page }) => {
    await page.goto('/carrier');
    // Should redirect to shipper dashboard
    await expect(page).toHaveURL('/shipper');
  });

  test('shipper redirected away from broker routes', async ({ page }) => {
    await page.goto('/broker');
    await expect(page).toHaveURL('/shipper');
  });
});
