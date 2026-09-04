import { test, expect } from '@playwright/test';

/**
 * Admin language toggle (i18n).
 *
 * The Playwright config sets locale: 'cs-CZ', so a fresh context defaults
 * to Czech via navigator.language. This spec verifies the manual toggle:
 * switching to English re-renders the admin texts in English and the choice
 * persists across reloads (localStorage).
 */

test.beforeEach(async ({ page }) => {
  // Mock the register API so the sent confirmation renders against the
  // static export (same mock pattern as admin-register.spec.ts).
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

test('defaults to Czech from the browser locale', async ({ page }) => {
  await page.goto('/admin/register/');
  await expect(page.getByRole('button', { name: 'Čeština' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

test('switches to English and persists across reloads', async ({ page }) => {
  await page.goto('/admin/register/');

  await page.getByRole('button', { name: 'English' }).click();
  await page.locator('input[type="email"]').fill('owner@example.cz');
  await page.locator('button.glass-submit').click();

  // The neutral confirmation renders in English only.
  await expect(page.locator('.glass-card')).toContainText(
    'If the account exists, the link was sent by email.'
  );
  await expect(page.locator('.glass-card')).not.toContainText(
    'Pokud účet existuje'
  );

  // The choice survives a reload (localStorage), still on a fresh context.
  await page.reload();
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('button', { name: 'Čeština' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});
