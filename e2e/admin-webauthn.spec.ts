import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Admin WebAuthn round trip (register a device, then sign in) — client-side
 * orchestration test.
 *
 * The Playwright harness serves the static export (npx serve) with no PHP, so
 * the /api/webauthn.php and /api/register.php backends are mocked. A CDP
 * virtual authenticator (CTAP2, resident key) drives the real
 * navigator.credentials.create/get calls.
 *
 * The test first performs a real registration ceremony (which creates a
 * discoverable credential on the authenticator), then a login ceremony that
 * discovers it. A discovery flow (empty allowCredentials) cannot succeed on an
 * authenticator that holds no credential, so the register step must run first.
 *
 * Real attestation/assertion verification lives on the PHP side and is out of
 * scope for the static harness; only the browser orchestration is asserted.
 */

const B64URL = 'ZGV2aWNlLWNoYWxsZW5nZQ'; // base64url of some bytes

function createArgs() {
  const rpId = 'tacukrarna.cz';
  return {
    createArgs: {
      publicKey: {
        rp: { id: rpId, name: 'Ta Cukrárna' },
        user: {
          id: B64URL,
          name: 'owner@example.cz',
          displayName: 'Owner',
        },
        challenge: B64URL,
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 120000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
      },
    },
  };
}

function getArgs() {
  return {
    getArgs: {
      publicKey: {
        challenge: B64URL,
        rpId: 'tacukrarna.cz',
        userVerification: 'required',
        timeout: 120000,
        allowCredentials: [],
      },
    },
  };
}

async function enableVirtualAuthenticator(
  context: BrowserContext,
  page: Page
): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
}

async function mockBackends(page: Page): Promise<void> {
  await page.addInitScript(
    ({ createArgs, getArgs }) => {
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

        if (urlStr.includes('action=validate-token')) {
          return json({ valid: true });
        }
        if (urlStr.includes('action=verify-password')) {
          return json({ ok: true });
        }
        if (urlStr.includes('action=challenge_register')) {
          return json(createArgs());
        }
        if (urlStr.includes('action=verify_register')) {
          return json({ status: 'success' });
        }
        if (urlStr.includes('action=challenge_login')) {
          return json(getArgs());
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
    },
    { createArgs, getArgs }
  );
}

test('registers a device then signs in, reaching the opening-hours form', async ({
  context,
  page,
  browserName,
}) => {
  // CDP virtual authenticators are only supported on Chromium.
  if (browserName !== 'chromium') test.skip();

  await enableVirtualAuthenticator(context, page);
  await mockBackends(page);

  // --- Registration ceremony via /admin/register/ with a valid token. ---
  await page.goto('/admin/register/?token=test-token');
  // The token is validated and the password prompt is shown.
  const pwInput = page.locator('input[type="password"]');
  await expect(pwInput).toBeVisible();
  await pwInput.fill('hunter2');
  await page.getByRole('button', { name: /Pokračovat/ }).click();

  // The browser WebAuthn prompt registers a resident credential; the mocked
  // verify_register returns success and the "ready" screen appears.
  await expect(page.getByText('Vaše zařízení je připraveno.')).toBeVisible();

  // --- Login ceremony via /admin/. ---
  await page.goto('/admin/');
  const signIn = page.getByRole('button', { name: /Přihlásit se/ });
  await expect(signIn).toBeVisible();
  await signIn.click();

  // The login discovers the resident credential and reaches the form.
  await expect(
    page.getByRole('heading', { name: /Správa otevírací doby/ })
  ).toBeVisible();

  // The form received the CSRF token from the mocked verify_login.
  await expect(page.getByRole('button', { name: /Uložit/ })).toBeVisible();
});
