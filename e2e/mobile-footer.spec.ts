import { test, expect } from '@playwright/test';

test.describe('Mobile version footer', () => {
  test('should auto-hide the version footer after 7 seconds', async ({
    page,
    browserName,
  }) => {
    // Playwright WebKit mobile viewport emulation has documented bugs intercepting window scroll events natively
    if (browserName === 'webkit') test.skip();

    test.setTimeout(15000); // Allow enough time for the 7 second timeout

    await page.goto('/');

    // Scroll slightly first if needed, then scroll to the absolute bottom using a massive static offset
    // WebKit bounds simulation requires this to ensure bottom boundary detection
    await page.evaluate(() => {
      window.scrollTo(0, 99999);
      window.dispatchEvent(new Event('scroll'));
    });

    const footer = page.locator('.version-footer');

    // Wait for the footer to become visible (triggered by scroll to bottom)
    await expect(footer).toHaveClass(/visible/);

    // Wait for a bit more than 7 seconds (7000ms duration)
    // We expect the visibility class to be removed
    // Using a loop or polling to not fail early if it takes exactly 7s
    await expect(footer).not.toHaveClass(/visible/, { timeout: 9000 });
  });
});
