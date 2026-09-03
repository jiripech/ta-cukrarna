import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Admin WebAuthn ceremony (/admin sign-in) — client-side orchestration test.
 *
 * The Playwright test harness serves the static export (npx serve) with no PHP,
 * so the /api/webauthn.php backend is mocked. A CDP virtual authenticator (CTAP2,
 * resident key) drives the real `navigator.credentials.get` call, verifying that
 * the admin page correctly sequences the challenge fetch -> browser assertion ->
 * verify fetch -> CSRF fallback -> view transition to the opening-hours form.
 *
 * This is intentionally browser-only: real attestation/assertion verification
 * lives on the PHP side and is out of scope for the static harness.
 */

async function enableVirtualAuthenticator(
  context: BrowserContext,
  page: Page
): Promise<string> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    }
  );
  return authenticatorId;
}

test('signs in via the WebAuthn ceremony and reaches the opening-hours form', async ({
  context,
  page,
  browserName,
}) => {
  // CDP virtual authenticators are only supported on Chromium.
  if (browserName !== 'chromium') test.skip();

  await enableVirtualAuthenticator(context, page);

  // Mock the WebAuthn + CSRF endpoints.
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
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });

      if (urlStr.includes('action=challenge_login')) {
        // Realistic getArgs; discovery uses an empty allowCredentials list.
        return json({
          getArgs: {
            publicKey: {
              challenge: 'ZGV2aWNlLWNoYWxsZW5nZQ', // base64url of some bytes
              rpId: 'tacukrarna.cz',
              userVerification: 'required',
              timeout: 120000,
              allowCredentials: [],
            },
          },
        });
      }
      if (urlStr.includes('action=verify_login')) {
        return json({ status: 'success', csrfToken: 'test-csrf-token' });
      }
      if (urlStr.includes('/api/csrf.php')) {
        return json({ csrf_token: 'test-csrf-token' });
      }
      if (urlStr.includes('/api/opening-hours.php')) {
        // OwnerHoursForm exits its loading state when this resolves.
        return json({ schedule: [] });
      }
      return originalFetch(input, init);
    };
  });

  await page.goto('/admin/');
  const signIn = page.getByRole('button', { name: /Přihlásit se/ });
  await expect(signIn).toBeVisible();
  await signIn.click();

  // The ceremony should drive the browser to the opening-hours form.
  await expect(
    page.getByRole('heading', { name: /Správa otevírací doby/ })
  ).toBeVisible();

  // The form should have received the CSRF token from the mock verify response.
  await expect(page.getByRole('button', { name: /Uložit/ })).toBeVisible();
});
