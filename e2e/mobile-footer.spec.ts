import { test, expect } from '@playwright/test';

test.describe('Mobile version footer', () => {
  test('should auto-hide the version footer after 7 seconds', async ({
    page,
    browserName,
  }) => {
    // Playwright WebKit mobile viewport emulation has documented bugs intercepting window scroll events natively
    if (browserName === 'webkit') test.skip();

    test.setTimeout(15000); // Allow enough time for the 7 second timeout

    // domcontentloaded, not the full "load" event: under parallel worker
    // load the homepage's images can keep "load" pending long after the DOM
    // (and the footer) are ready - which stalled goto for the full test
    // timeout. The assertion only needs the footer element and its timer.
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const footer = page.locator('.version-footer');

    // Wait for footer to be in DOM (hydration complete)
    await expect(footer).toBeAttached({ timeout: 10000 });

    // Trigger scroll to bottom to show footer
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      window.dispatchEvent(new Event('scroll'));
    });

    // Wait for visible class (with polling for hydration timing)
    await expect(async () => {
      await expect(footer).toHaveClass(/visible/, { timeout: 1000 });
    }).toPass({ timeout: 10000 });

    // Wait for a bit more than 7 seconds (7000ms duration)
    // We expect the visibility class to be removed
    await expect(footer).not.toHaveClass(/visible/, { timeout: 9000 });
  });
});
