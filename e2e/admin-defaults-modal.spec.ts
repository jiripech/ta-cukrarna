import { test, expect, type Page } from '@playwright/test';

/**
 * "Upravit výchozí" (Edit defaults) modal — layout and keyboard behaviour.
 *
 * Regression coverage for three defects reported on the admin page:
 *
 *  1. the overlay rendered the `summer` and `spring` day grids stacked, so it
 *     looked like two forms (dialogCount was fine, but 14 day inputs were
 *     visible at once);
 *  2. the Cancel button was pushed ~20px outside the modal card to the left of
 *     the full-width Save button (`.glass-submit-full { width: 100% }`);
 *  3. Escape did nothing — only the backdrop click and the Cancel button closed
 *     the overlay.
 *
 * Harness: the static export is served by `npx serve out` with no PHP backend,
 * so every `/api/*.php` call is mocked and `navigator.credentials` is stubbed
 * (the production RP ID `tacukrarna.cz` is rejected on a 127.0.0.1 origin).
 * The Playwright config sets locale `cs-CZ`, so the UI renders in Czech.
 */

declare global {
  interface Window {
    // Counts POSTs to /api/opening-hours.php so we can prove Escape never saves.
    __defaultsPosts: number;
  }
}

const CHALLENGE_B64URL = 'ZGV2aWNlLWNoYWxsZW5nZQ';

async function mockBackends(page: Page): Promise<void> {
  await page.addInitScript(
    ({ challenge }) => {
      Object.defineProperty(window.navigator, 'credentials', {
        configurable: true,
        get: () => ({
          get: async () => ({
            rawId: new ArrayBuffer(8),
            response: {
              clientDataJSON: new ArrayBuffer(8),
              authenticatorData: new ArrayBuffer(8),
              signature: new ArrayBuffer(8),
            },
          }),
        }),
      });

      window.__defaultsPosts = 0;
      const originalFetch = window.fetch;
      window.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
      ): Promise<Response> => {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = (
          init?.method ??
          (typeof input === 'object' && 'method' in input
            ? (input as Request).method
            : 'GET')
        ).toUpperCase();
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          });

        if (urlStr.includes('action=challenge_login')) {
          return json({
            getArgs: {
              publicKey: {
                challenge,
                rpId: 'tacukrarna.cz',
                userVerification: 'required',
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
          if (method === 'POST') window.__defaultsPosts += 1;
          return json({
            schedule: [
              {
                startDate: '2026-01-01',
                endDate: '9999-12-31',
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
            exceptions: [],
            defaults: {
              summer: {
                mon: '8:00 - 12:00',
                tue: '',
                wed: '',
                thu: '',
                fri: '',
                sat: '',
                sun: '',
              },
              spring: {
                mon: '',
                tue: '',
                wed: '',
                thu: '',
                fri: '7:00 - 15:00',
                sat: '',
                sun: '',
              },
            },
          });
        }
        return originalFetch(input, init);
      };
    },
    { challenge: CHALLENGE_B64URL }
  );
}

test.beforeEach(async ({ page }) => {
  await mockBackends(page);
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(
    page.getByRole('heading', { name: 'Správa otevírací doby' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Upravit výchozí' }).click();
});

test('opens a single defaults form with one season visible at a time', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Exactly one overlay is rendered.
  await expect(dialog).toHaveCount(1);

  // One form at a time: only the active season's seven day inputs are visible.
  await expect(dialog.locator('input[id^="default-"]:visible')).toHaveCount(7);

  // The season switcher is present and functional.
  const summerTab = dialog.getByRole('tab', { name: 'Léto', exact: true });
  const outsideTab = dialog.getByRole('tab', {
    name: 'Mimo léto',
    exact: true,
  });
  await expect(summerTab).toBeVisible();
  await expect(outsideTab).toBeVisible();
  // Exactly one season is selected (which one depends on the current month).
  await expect(
    dialog.locator('[role="tab"][aria-selected="true"]')
  ).toHaveCount(1);

  await outsideTab.click();
  await expect(outsideTab).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('input[id^="default-"]:visible')).toHaveCount(7);
  await expect(
    dialog.getByLabel('Mimo léto Pátek', { exact: true })
  ).toHaveValue('7:00 - 15:00');
});

test('keeps the Cancel button inside the modal card, to the left of Save', async ({
  page,
}) => {
  const dialog = page.getByRole('dialog');
  const card = dialog.locator(':scope > div').first();
  const cancel = dialog.getByRole('button', { name: 'Zrušit' });
  const save = dialog.getByRole('button', { name: 'Uložit' });

  await expect(cancel).toBeVisible();
  await expect(save).toBeVisible();

  const cardBox = await card.boundingBox();
  const cancelBox = await cancel.boundingBox();
  const saveBox = await save.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(saveBox).not.toBeNull();

  // Cancel must be rendered inside the card and to the left of Save.
  expect(cancelBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(cancelBox!.x + cancelBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width
  );
  expect(cancelBox!.x).toBeLessThan(saveBox!.x);
});

test('closes the modal on Escape without saving changes', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  // Escape only dismisses the overlay: no save request was issued.
  expect(await page.evaluate(() => window.__defaultsPosts)).toBe(0);
  await expect(
    page.getByRole('button', { name: 'Upravit výchozí' })
  ).toBeVisible();
});
