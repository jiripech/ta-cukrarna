import { test, expect } from '@playwright/test';

test.describe('Offline Progressive Web App Capabilities', () => {
  test('should cache and serve HTML, styles, and fonts when offline', async ({
    browser,
  }) => {
    // Create a new context
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Visit the home page online
    await page.goto('/');

    // 2. Wait for the Service Worker to register and become active
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.state === 'activated';
    });

    // Let the Service Worker lazily cache assets in the background
    await page.waitForTimeout(3000);

    // Track requested assets
    const requestedAssets: Set<string> = new Set();

    // Listen for requests to track what gets loaded in offline mode
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/_next/static/') || url.includes('/img/')) {
        requestedAssets.add(url);
      }
    });

    // 3. Go offline
    await context.setOffline(true);

    // 4. Reload page (offline context)
    let reloadResponse;
    try {
      reloadResponse = await page.reload({ waitUntil: 'networkidle' });
    } catch (e) {
      console.error('Page reload failed while offline:', e);
    }

    // Verify page successfully loaded (Service worker fallback for HTML)
    expect(reloadResponse).not.toBeNull();
    if (reloadResponse) {
      expect(reloadResponse.status()).toBe(200);
    }

    // The title should be present, ensuring HTML renderer was cached
    const pageTitle = await page.title();
    expect(pageTitle).toContain('Cukrárna v centru Hradce Králové');

    // 5. Verify that static assets like fonts and CSS were requested and not aborted
    // Next.js style and google font files are inside /_next/static/
    const staticAssetsLoaded = Array.from(requestedAssets).some(
      url =>
        url.includes('/_next/static/css') || url.includes('/_next/static/media')
    );

    expect(staticAssetsLoaded).toBe(true);

    await context.close();
  });
});
