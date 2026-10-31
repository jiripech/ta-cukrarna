import { test, expect } from '@playwright/test';
import {
  expectedRpId,
  loadTestCredentials,
  resetPasskeyCounter,
  signInViaUi,
  stubSoftWebauthn,
} from './helpers/soft-webauthn';

/**
 * Admin REGISTRATION round trip against the REAL PHP backend (Docker).
 *
 * Exercises the full production flow without MariaDB/IMAP (the container's
 * ADMIN_USERS env bypasses the account lookup and the IMAP password proof):
 *
 *   1. /admin/register/?token=... - the pre-inserted token from the seeder
 *      (validate-token); with ADMIN_USERS configured the server reports
 *      password_required=false, so the password step is skipped entirely
 *   2. WebAuthn ceremony: challenge_register -> verify_register with a REAL
 *      ES256 attestation built by the software authenticator (fresh keypair,
 *      fmt 'none') -> passkey stored in SQLite
 *   3. Sign in through /admin/ with the NEWLY registered passkey
 *
 * Gated on DOCKER_E2E=1 (npm run test:e2e:docker) - the CI static harness
 * has no PHP backend. Chromium-only: the counter budget of the seeded
 * passkey (see e2e/helpers/soft-webauthn.ts).
 */

test.skip(
  !process.env.DOCKER_E2E,
  'requires the Docker PHP backend (npm run test:e2e:docker)'
);

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'the covered verification happens server-side and is ' +
    'browser-independent; chromium-only keeps the Docker suite fast'
);

test.beforeEach(() => resetPasskeyCounter());

test('owner can register a new passkey and sign in with it', async ({
  page,
}) => {
  const creds = loadTestCredentials();
  if (!creds.registerToken) {
    throw new Error(
      'registerToken missing in test-credentials.json - reseed the container'
    );
  }

  await stubSoftWebauthn(page, creds);

  // Regression guard: the server must honour WEBAUTHN_RP_ID from the
  // container .env - a real browser rejects the production RP ID on
  // localhost, so a stale rp.id here breaks the manual flow silently.
  const challengePromise = page.waitForResponse(r =>
    r.url().includes('challenge_register')
  );

  // --- token + ceremony ---
  // With ADMIN_USERS configured the server reports password_required=false,
  // so the password step is skipped and the WebAuthn ceremony starts right
  // after the token validation (challenge_register / verify_register are
  // real; the passkey is built by the software authenticator).
  await page.goto(`/admin/register/?token=${creds.registerToken}`);

  const challengeRes = await challengePromise;
  const challengeData = await challengeRes.json();
  expect(challengeData.createArgs.publicKey.rp.id).toBe(expectedRpId());

  await expect(page.getByText('Vaše zařízení je připraveno.')).toBeVisible();

  // --- sign in with the newly registered passkey ---
  await signInViaUi(page);
  await expect(page.getByRole('link', { name: 'Odhlásit se' })).toBeVisible();
});
