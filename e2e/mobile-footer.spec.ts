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

    const footer = page.locator('.version-footer');

    // Due to Next.js Hydration timing, the scroll listener might not be attached immediately after goto('/') resolves.
    // Using toPass() ensures Playwright keeps actively scrolling and checking until the component officially reacts.
    await expect(async () => {
      await page.keyboard.press('End');
      await page.mouse.wheel(0, 99999);
      await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

      await expect(footer).toHaveClass(/visible/, { timeout: 1000 });
    }).toPass({ timeout: 10000 });

    // Wait for a bit more than 7 seconds (7000ms duration)
    // We expect the visibility class to be removed
    // Using a loop or polling to not fail early if it takes exactly 7s
    await expect(footer).not.toHaveClass(/visible/, { timeout: 9000 });
  });
});
