import { test, expect } from '@playwright/test';

/**
 * Christmas Promo Block (id="promo").
 *
 * Verifies the promo block is rendered on the homepage with the correct
 * content (h2 "Vánoce" and link to the Christmas shop) when the current
 * date is on or before December 20. The block is hidden after that date.
 */

test.describe('Christmas Promo Block', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the register API so the static export works without PHP backend
    await page.addInitScript(() => {
      const previous = window.fetch;
      window.fetch = async (
        input: URL | RequestInfo,
        init?: RequestInit
      ): Promise<Response> => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.includes('/api/register.php')) {
          return new Response(
            JSON.stringify({ status: 'success', message: 'ok' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        return previous(input, init);
      };
    });
  });

  test('promo block is visible on homepage with correct content before Dec 20', async ({
    page,
  }) => {
    await page.goto('/');

    // Check the promo section exists with id="promo"
    const promoSection = page.locator('#promo');
    await expect(promoSection).toBeVisible();

    // Check the h2 with text "Vánoce"
    await expect(promoSection.locator('h2')).toHaveText('Vánoce');

    // Check the link with correct href and text (no paragraph)
    const promoLink = promoSection.locator(
      'a[href="https://obchod.tacukrarna.cz/kategorie/vanoce"]'
    );
    await expect(promoLink).toBeVisible();
    await expect(promoLink).toHaveText('Objednat vánoční cukroví nebo vánočku');
    await expect(promoLink).toHaveAttribute('target', '_blank');
    await expect(promoLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
