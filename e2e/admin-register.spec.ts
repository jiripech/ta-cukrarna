import { test, expect } from '@playwright/test';

/**
 * Admin registration flow (/admin/register).
 *
 * Covers the "no-clues" liquid-glass request screen:
 *  - a bare email input is shown with no submit button
 *  - the submit button only appears once a valid email is typed
 *  - submitting fires the request-token call and shows the neutral "sent"
 *    confirmation (identical whether or not the account exists).
 *
 * The fetch to /api/register.php is mocked so the static export can be tested
 * without the PHP backend / mail infrastructure.
 */

declare global {
  interface Window {
    __registerRequest: { url: string; body: unknown } | null;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__registerRequest = null;
  });

  // Mock the register API so the ceremony can run against the static export.
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (
      input: URL | RequestInfo,
      init?: RequestInit
    ): Promise<Response> => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (urlStr.includes('/api/register.php')) {
        const body = init?.body ? JSON.parse(init.body as string) : null;
        window.__registerRequest = { url: urlStr, body };
        return new Response(
          JSON.stringify({
            status: 'success',
            message:
              'Pokud účet existuje, obdržíte e-mail s odkazem. / If the account exists, you will receive an email with a link.',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
      return originalFetch(input, init);
    };
  });

  await page.goto('/admin/register/');
});

test('shows a bare email input with no submit button initially', async ({
  page,
}) => {
  const input = page.locator('input[type="email"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(page.locator('button')).toHaveCount(0);
});

test('keeps the submit button hidden for an invalid email', async ({
  page,
}) => {
  const input = page.locator('input[type="email"]');
  await input.fill('not-an-email');
  await page.waitForTimeout(100);
  await expect(page.locator('button')).toHaveCount(0);

  await input.fill('missing-tld@example');
  await page.waitForTimeout(100);
  await expect(page.locator('button')).toHaveCount(0);
});

test('reveals the submit button once a valid email is typed', async ({
  page,
}) => {
  const input = page.locator('input[type="email"]');
  const submit = page.locator('button.glass-submit');

  await input.fill('owner@example.cz');
  await expect(submit).toBeVisible();
  await expect(submit).toHaveText('→');
});

test('submitting sends the request-token call and shows the neutral confirmation', async ({
  page,
}) => {
  await page.locator('input[type="email"]').fill('owner@example.cz');
  const submit = page.locator('button.glass-submit');
  await expect(submit).toBeVisible();
  await submit.click();

  // The page should switch to the neutral "sent" confirmation.
  await expect(page.locator('.glass-card')).toContainText(
    'Pokud účet existuje, e-mail s odkazem byl odeslán.'
  );

  // The mocked API should have received the submitted email.
  const sent = await page.evaluate(() => window.__registerRequest);
  expect(sent).not.toBeNull();
  expect(sent?.url).toContain('action=request-token');
  expect((sent?.body as { username?: string })?.username).toBe(
    'owner@example.cz'
  );
});
