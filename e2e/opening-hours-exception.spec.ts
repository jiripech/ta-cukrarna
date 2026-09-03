import { test, expect } from '@playwright/test';

/**
 * Date-based opening-hours exceptions.
 *
 *  1. Public display: an exception for today's local date overrides the
 *     weekly schedule row; without one, the closed weekday keeps its normal
 *     (non-red) rendering because `hasNotClosedText('')` is false.
 *  2. Admin round trip: the exception loaded from the API renders in
 *     OwnerHoursForm, a second one is added through the UI, and the POST body
 *     carries both.
 *
 * The Playwright harness serves the static export (npx serve) from
 * http://127.0.0.1:3001 with no PHP backend, so every /api/*.php endpoint is
 * mocked via window.fetch overrides. A real WebAuthn ceremony cannot run
 * here either: the app's RP ID is tacukrarna.cz, which the browser rejects
 * on a 127.0.0.1 origin, so navigator.credentials is stubbed (same approach
 * as admin-webauthn.spec.ts).
 */

declare global {
  interface Window {
    __hoursRequest: { url: string; body: unknown } | null;
  }
}

// 2026-09-04 is a Friday. The clock is pinned to midday Prague time and the
// timezone fixed so the component's local-date helper resolves the same
// YYYY-MM-DD on any runner.
const EXCEPTION_DATE = '2026-09-04';

test.use({ timezoneId: 'Europe/Prague' });

const BASE_JSON = {
  schedule: [
    {
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      days: {
        mon: '9:00 - 17:00',
        tue: '9:00 - 17:00',
        wed: '9:00 - 17:00',
        thu: '9:00 - 17:00',
        fri: '',
        sat: '',
        sun: '',
      },
    },
  ],
};

// base64url of "device-challenge" / "device-user" test vectors.
const CHALLENGE_B64URL = 'ZGV2aWNlLWNoYWxsZW5nZQ';
const USER_ID_B64URL = 'ZGV2aWNlLXVzZXI';

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

const HOURS_GET_RESPONSE = {
  schedule: [
    {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      days: {
        mon: '9:00 - 17:00',
        tue: '',
        wed: '',
        thu: '',
        fri: '',
        sat: '',
        sun: '',
      },
    },
  ],
  exceptions: [{ date: EXCEPTION_DATE, hours: '9:00 - 15:00' }],
};

const HOURS_POST_RESPONSE = {
  status: 'success',
  schedule: [],
  exceptions: [],
};

async function mockOpeningHoursJson(
  page: import('@playwright/test').Page,
  data: unknown
): Promise<void> {
  await page.addInitScript(dataToMock => {
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
      if (urlStr.includes('/opening-hours.jsonc')) {
        // Serve actual JSONC (comment + trailing comma) to exercise the
        // tolerant parser end to end.
        const json = JSON.stringify(dataToMock, null, 2);
        const body =
          '// hand-edited opening hours\n' + json.slice(0, -1) + ',\n}';
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    };
  }, data);
}

async function mockAdminBackends(
  page: import('@playwright/test').Page
): Promise<void> {
  await page.addInitScript(
    ({ createArgs, getArgs, hoursGet, hoursPost }) => {
      // Stub the browser WebAuthn API (RP ID cannot match the test origin).
      const fakeResponse = { clientDataJSON: new ArrayBuffer(8) };
      Object.defineProperty(window.navigator, 'credentials', {
        configurable: true,
        get: () => ({
          create: async () =>
            ({
              response: {
                clientDataJSON: fakeResponse.clientDataJSON,
                attestationObject: new ArrayBuffer(8),
              },
            }) as unknown as PublicKeyCredential,
          get: async () =>
            ({
              rawId: new ArrayBuffer(8),
              response: {
                clientDataJSON: fakeResponse.clientDataJSON,
                authenticatorData: new ArrayBuffer(8),
                signature: new ArrayBuffer(8),
              },
            }) as unknown as PublicKeyCredential,
        }),
      });
      window.__hoursRequest = null;

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
          if ((init?.method ?? 'GET') === 'POST') {
            const body = init?.body ? JSON.parse(init.body as string) : null;
            window.__hoursRequest = { url: urlStr, body };
            // OwnerHoursForm only checks res.ok, the body is informational.
            return json(hoursPost);
          }
          return json(hoursGet);
        }
        return originalFetch(input, init);
      };
    },
    {
      createArgs: CREATE_ARGS,
      getArgs: GET_ARGS,
      hoursGet: HOURS_GET_RESPONSE,
      hoursPost: HOURS_POST_RESPONSE,
    }
  );
}

test.describe('public display', () => {
  test('overrides the Friday row with the exception hours on its date', async ({
    page,
  }) => {
    await mockOpeningHoursJson(page, {
      ...BASE_JSON,
      exceptions: [{ date: EXCEPTION_DATE, hours: '9:00 - 15:00' }],
    });
    await page.clock.setFixedTime(new Date('2026-09-04T12:00:00+02:00'));
    await page.goto('/');

    const patekRow = page
      .locator('#opening-hours > div > div')
      .filter({ hasText: 'Pátek' });
    await expect(patekRow).toContainText('9:00 - 15:00');
    // Non-empty exception hours render as normal (not closed-red) text.
    await expect(patekRow.locator('span').nth(1)).not.toHaveClass(
      /text-red-600/
    );
  });

  test('keeps the empty Friday row without red closed styling when no exception exists', async ({
    page,
  }) => {
    await mockOpeningHoursJson(page, BASE_JSON);
    await page.clock.setFixedTime(new Date('2026-09-04T12:00:00+02:00'));
    await page.goto('/');

    // The schedule has fri: '' and hasNotClosedText('') is false, so the
    // row renders an empty hours cell with the normal font-medium class.
    const patekRow = page
      .locator('#opening-hours > div > div')
      .filter({ hasText: 'Pátek' });
    await expect(patekRow).toHaveText('Pátek');
    const hoursCell = patekRow.locator('span').nth(1);
    await expect(hoursCell).toHaveClass(/font-medium/);
    await expect(hoursCell).not.toHaveClass(/text-red-600/);
  });
});

test('admin loads, adds and saves date exceptions round-trip', async ({
  page,
}) => {
  await mockAdminBackends(page);

  // --- Registration ceremony via /admin/register/ with a valid token. ---
  await page.goto('/admin/register/?token=test-token');
  const pwInput = page.locator('input[type="password"]');
  await expect(pwInput).toBeVisible();
  await pwInput.fill('hunter2');
  await page.getByRole('button', { name: /Pokračovat/ }).click();
  await expect(page.getByText('Vaše zařízení je připraveno.')).toBeVisible();

  // --- Login ceremony via /admin/. ---
  await page.goto('/admin/');
  const signIn = page.getByRole('button', { name: /Přihlásit se/ });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(
    page.getByRole('heading', { name: /Správa otevírací doby/ })
  ).toBeVisible();

  // The mocked exception renders with the stored date and hours.
  await expect(
    page.getByLabel(`Datum výjimky / Exception date ${EXCEPTION_DATE}`)
  ).toHaveValue(EXCEPTION_DATE);
  await expect(
    page.getByLabel(
      `Hodiny pro ${EXCEPTION_DATE} / Hours for ${EXCEPTION_DATE}`
    )
  ).toHaveValue('9:00 - 15:00');

  // Add a second exception through the UI.
  await page.getByRole('button', { name: /Přidat výjimku/ }).click();
  await page
    .getByLabel('Datum výjimky / Exception date', { exact: true })
    .fill('2026-12-24');
  await page
    .getByLabel('Hodiny pro 2026-12-24 / Hours for 2026-12-24')
    .fill('9:00 - 12:00');

  await page.getByRole('button', { name: /Uložit/ }).click();
  await expect(
    page.getByText('Otevírací doba byla úspěšně uložena.')
  ).toBeVisible();

  const sent = await page.evaluate(() => window.__hoursRequest);
  expect(sent).not.toBeNull();
  expect(sent?.url).toContain('/api/opening-hours.php');
  const body = (sent?.body ?? {}) as {
    schedule: unknown[];
    exceptions: { date: string; hours: string }[];
  };
  expect(body.schedule).toHaveLength(1);
  expect(body.exceptions).toEqual([
    { date: EXCEPTION_DATE, hours: '9:00 - 15:00' },
    { date: '2026-12-24', hours: '9:00 - 12:00' },
  ]);
});
