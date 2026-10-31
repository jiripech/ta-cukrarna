import { test, expect } from '@playwright/test';
import {
  expectedRpId,
  loadTestCredentials,
  resetPasskeyCounter,
  stubSoftWebauthn,
} from './helpers/soft-webauthn';

/**
 * Admin sign-in against the REAL PHP backend (Docker test container).
 *
 * Unlike admin-webauthn.spec.ts (which mocks the PHP endpoints for the static
 * harness), this spec exercises the real /api/webauthn.php round trip:
 * challenge_login -> verify_login with a REAL ES256 signature -> SQLite
 * lookup -> admin session. Only `navigator.credentials` is stubbed - see
 * e2e/helpers/soft-webauthn.ts.
 *
 * Gated on DOCKER_E2E=1 (npm run test:e2e:docker) - the CI static harness
 * has no PHP backend, so the spec must skip there.
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

test('owner can sign in with the seeded passkey (real PHP verification)', async ({
  page,
}) => {
  await stubSoftWebauthn(page, loadTestCredentials());

  // Regression guard: the server must honour WEBAUTHN_RP_ID (see
  // expectedRpId() - the software authenticator adapts to any RP ID, so
  // only this assertion catches a stale server configuration).
  const challengePromise = page.waitForResponse(r =>
    r.url().includes('challenge_login')
  );

  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();

  const challengeRes = await challengePromise;
  const challengeData = await challengeRes.json();
  expect(challengeData.getArgs.publicKey.rpId).toBe(expectedRpId());

  await expect(
    page.getByRole('heading', { name: 'Správa otevírací doby' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Odhlásit se' })).toBeVisible();
});
