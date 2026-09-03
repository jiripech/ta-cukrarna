import { test, expect } from '@playwright/test';

/**
 * Admin WebAuthn round trip (register a device, then sign in) — client-side
 * orchestration test.
 *
 * The Playwright harness serves the static export (npx serve) from
 * http://127.0.0.1:3001 with no PHP backend, so two things are mocked:
 *
 *  1. The PHP endpoints (/api/register.php, /api/webauthn.php, /api/csrf.php,
 *     /api/opening-hours.php).
 *  2. `navigator.credentials` itself. A real ceremony cannot run here: the
 *     app's RP ID is tacukrarna.cz, and WebAuthn rejects an RP ID that is not
 *     a registrable suffix of the test origin (127.0.0.1), so both
 *     credentials.create() and credentials.get() would always fail.
 *
 * Stubbing the browser API keeps what the app actually owns under test: the
 * base64url -> ArrayBuffer mapping of the backend options, the sequencing of
 * the challenge/verify fetches, and the view transitions.
 */

declare global {
  interface Window {
    __webauthnCalls: {
      create: { challenge: number[]; userId: number[] } | null;
      get: { challenge: number[] } | null;
    };
  }
}

// base64url of "device-challenge" / "device-user" test vectors.
const CHALLENGE_B64URL = 'ZGV2aWNlLWNoYWxsZW5nZQ';
const USER_ID_B64URL = 'ZGV2aWNlLXVzZXI';
const EXPECTED_CHALLENGE_BYTES = [...'device-challenge'].map(c =>
  c.charCodeAt(0)
);
const EXPECTED_USER_BYTES = [...'device-user'].map(c => c.charCodeAt(0));

const CREATE_ARGS = {
  createArgs: {
    publicKey: {
      rp: { id: 'tacukrarna.cz', name: 'Ta Cukrárna' },
      user: {
        id: USER_ID_B64URL,
        name: 'owner@example.cz',
        displayName: 'Owner',
      },
      challenge: CHALLENGE_B64URL,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 120000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'required' },
    },
  },
};

const GET_ARGS = {
  getArgs: {
    publicKey: {
      challenge: CHALLENGE_B64URL,
      rpId: 'tacukrarna.cz',
      userVerification: 'required',
      timeout: 120000,
      allowCredentials: [],
    },
  },
};

async function mockBackends(
  page: import('@playwright/test').Page
): Promise<void> {
  await page.addInitScript(
    ({ createArgs, getArgs }) => {
      // Stub the browser WebAuthn API (RP ID cannot match the test origin).
      const fakeResponse = { clientDataJSON: new ArrayBuffer(8) };
      Object.defineProperty(window.navigator, 'credentials', {
        configurable: true,
        get: () => ({
          create: async (opts: CredentialCreationOptions) => {
            const pk = opts.publicKey!;
            window.__webauthnCalls.create = {
              challenge: [...new Uint8Array(pk.challenge as ArrayBuffer)],
              userId: [
                ...new Uint8Array(
                  (pk.user as PublicKeyCredentialUserEntity).id
                ),
              ],
            };
            return {
              response: {
                clientDataJSON: fakeResponse.clientDataJSON,
                attestationObject: new ArrayBuffer(8),
              },
            } as unknown as PublicKeyCredential;
          },
          get: async (opts: CredentialRequestOptions) => {
            const pk = opts.publicKey!;
            window.__webauthnCalls.get = {
              challenge: [...new Uint8Array(pk.challenge as ArrayBuffer)],
            };
            return {
              rawId: new ArrayBuffer(8),
              response: {
                clientDataJSON: fakeResponse.clientDataJSON,
                authenticatorData: new ArrayBuffer(8),
                signature: new ArrayBuffer(8),
              },
            } as unknown as PublicKeyCredential;
          },
        }),
      });
      window.__webauthnCalls = { create: null, get: null };

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
          return json(createArgs);
        }
        if (urlStr.includes('action=verify_register')) {
          return json({ status: 'success' });
        }
        if (urlStr.includes('action=challenge_login')) {
          return json(getArgs);
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
    {
      createArgs: CREATE_ARGS,
      getArgs: GET_ARGS,
    }
  );
}

test('registers a device then signs in, reaching the opening-hours form', async ({
  page,
}) => {
  await mockBackends(page);

  // --- Registration ceremony via /admin/register/ with a valid token. ---
  await page.goto('/admin/register/?token=test-token');
  const pwInput = page.locator('input[type="password"]');
  await expect(pwInput).toBeVisible();
  await pwInput.fill('hunter2');
  await page.getByRole('button', { name: /Pokračovat/ }).click();

  // credentials.create was called with the decoded binary fields.
  await expect
    .poll(() => page.evaluate(() => window.__webauthnCalls.create))
    .toEqual({
      challenge: EXPECTED_CHALLENGE_BYTES,
      userId: EXPECTED_USER_BYTES,
    });

  // The mocked verify_register returned success -> "ready" screen.
  await expect(page.getByText('Vaše zařízení je připraveno.')).toBeVisible();

  // --- Login ceremony via /admin/. ---
  await page.goto('/admin/');
  const signIn = page.getByRole('button', { name: /Přihlásit se/ });
  await expect(signIn).toBeVisible();
  await signIn.click();

  // credentials.get was called with the decoded challenge.
  await expect
    .poll(() => page.evaluate(() => window.__webauthnCalls.get))
    .toEqual({ challenge: EXPECTED_CHALLENGE_BYTES });

  // The login reached the opening-hours form with the CSRF token.
  await expect(
    page.getByRole('heading', { name: /Správa otevírací doby/ })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Uložit/ })).toBeVisible();
});
