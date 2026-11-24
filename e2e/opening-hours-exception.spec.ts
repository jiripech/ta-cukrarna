import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import {
  loadTestCredentials,
  resetPasskeyCounter,
  signInViaUi,
  stubSoftWebauthn,
} from './helpers/soft-webauthn';

/**
 * Returns a local YYYY-MM-DD string for a given weekday (1=Mon ... 5=Fri)
 * of the current week, matching getWeekdayDate() in OpeningHours.tsx.
 */
function getWeekdayDate(weekday: 1 | 2 | 3 | 4 | 5): string {
  const date = new Date();
  const currentDay = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  let daysToAdd = weekday - currentDay;
  if (daysToAdd < 0) daysToAdd += 7;
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Date-based opening-hours exceptions.
 *
 *  1. Public display: the weekday rows render from the real docroot
 *     opening-hours.jsonc (served by the PHP backend in Docker mode; the
 *     static export copy in CI).
 *  2. Admin round trip: sign in through the real admin UI (software
 *     authenticator, real PHP verification - see e2e/helpers/soft-webauthn.ts),
 *     add an exception through OwnerHoursForm and save it - the save POSTs
 *     the session's real CSRF token to /api/opening-hours.php which writes
 *     the docroot file.
 *
 * The admin tests are gated on DOCKER_E2E=1 (npm run test:e2e:docker):
 * they need the real PHP backend for login, CSRF and the save endpoint.
 */

// 2026-01-09 is a Friday and outside the extended summer period
// (June 1 – October 14), so the non-summer schedule applies.
const EXCEPTION_DATE = '2026-01-09';

test.use({ timezoneId: 'Europe/Prague' });

test.describe('public display', () => {
  test('Friday row renders normally when no exception exists for that date', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the OpeningHours component to load its data (async fetch)
    // The component fetches /opening-hours.jsonc and /holiday.jsonc in a useEffect
    // so we wait for the first day name to appear in the DOM
    await page.waitForFunction(
      () => {
        const openingHours = document.getElementById('opening-hours');
        if (!openingHours) return false;
        const text = openingHours.textContent || '';
        return (
          text.includes('Pátek') ||
          text.includes('Patek') ||
          text.includes('Friday')
        );
      },
      { timeout: 30000 }
    );

    const patekRow = page
      .locator('#opening-hours > div > div')
      .filter({ hasText: 'Pátek' });
    await expect(patekRow).toContainText('Pátek');
    const hoursCell = patekRow.locator('span').nth(1);
    await expect(hoursCell).toHaveClass(/font-medium/);
    await expect(hoursCell).not.toHaveClass(/text-red-600/);
  });

  test('displays exceptions for upcoming weekdays in their respective rows', async ({
    page,
  }) => {
    // Modify the docroot opening-hours.jsonc to add exceptions for
    // Wednesday and Thursday of the current week, then verify they appear
    // in their respective day rows with the "(výjimka)" label.
    const docrootJsonc = resolve(__dirname, '..', 'out', 'opening-hours.jsonc');
    const sourceJsonc = resolve(
      __dirname,
      '..',
      'public',
      'opening-hours.jsonc'
    );
    const originalContent = readFileSync(sourceJsonc, 'utf8');

    const wednesday = getWeekdayDate(3); // 3 = Wednesday
    const thursday = getWeekdayDate(4); // 4 = Thursday

    const modifiedContent = JSON.stringify({
      schedule: [
        {
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          days: {
            mon: '9:00 - 17:00',
            tue: '9:00 - 16:00',
            wed: '9:00 - 16:00',
            thu: '9:00 - 19:00',
            fri: '9:00 - 17:00',
            sat: '',
            sun: '',
          },
        },
      ],
      exceptions: [
        { date: wednesday, hours: '10:00 - 14:00' }, // exception for Wednesday
        { date: thursday, hours: '' }, // closed on Thursday
      ],
    });

    writeFileSync(docrootJsonc, modifiedContent);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for the OpeningHours component to load its data
      await page.waitForFunction(
        () => {
          const openingHours = document.getElementById('opening-hours');
          if (!openingHours) return false;
          const text = openingHours.textContent || '';
          return text.includes('Středa') && text.includes('Čtvrtek');
        },
        { timeout: 30000 }
      );

      // Verify Wednesday row shows the exception hours with "(výjimka)" label
      const wednesdayRow = page
        .locator('#opening-hours > div > div')
        .filter({ hasText: 'Středa' });
      await expect(wednesdayRow).toContainText('Středa');
      const wednesdayHoursCell = wednesdayRow.locator('span').nth(1);
      await expect(wednesdayHoursCell).toContainText('10:00 - 14:00');
      await expect(wednesdayRow.locator('span').nth(2)).toContainText(
        '(výjimka)'
      );

      // Verify Thursday row shows "Zavřeno" with "(výjimka)" label (closed)
      const thursdayRow = page
        .locator('#opening-hours > div > div')
        .filter({ hasText: 'Čtvrtek' });
      await expect(thursdayRow).toContainText('Čtvrtek');
      const thursdayHoursCell = thursdayRow.locator('span').nth(1);
      await expect(thursdayHoursCell).toContainText('Zavřeno');
      await expect(thursdayRow.locator('span').nth(2)).toContainText(
        '(výjimka)'
      );
    } finally {
      // Restore the original file
      writeFileSync(docrootJsonc, originalContent);
    }
  });
});

test.describe('admin round trip', () => {
  test.skip(
    !process.env.DOCKER_E2E,
    'requires the Docker PHP backend (npm run test:e2e:docker)'
  );

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'the seeded passkey counter resets only at container start, so the ' +
      'sign-in tests run on chromium only to stay within the counter budget'
  );

  test.beforeEach(() => resetPasskeyCounter());

  // The save test writes through the real PHP backend into the docroot
  // opening-hours.jsonc (out/ on the host via bind mount); restore the
  // pristine copy afterwards so later tests (and the workspace) keep the
  // original schedule.
  const docrootJsonc = resolve(__dirname, '..', 'out', 'opening-hours.jsonc');
  const sourceJsonc = resolve(__dirname, '..', 'public', 'opening-hours.jsonc');
  const restoreDocrootJsonc = (): void =>
    writeFileSync(docrootJsonc, readFileSync(sourceJsonc));

  test.afterEach(restoreDocrootJsonc);

  test('admin signs in, adds and saves a date exception', async ({ page }) => {
    await stubSoftWebauthn(page, loadTestCredentials());

    // Real login opens the admin session (and the form loads the schedule
    // through the real /api/opening-hours.php with a real CSRF token).
    await signInViaUi(page);

    // Add a new exception through the UI.
    await page.getByRole('button', { name: 'Přidat výjimku' }).click();
    await page
      .getByLabel('Datum výjimky', { exact: true })
      .fill(EXCEPTION_DATE);
    await page.getByLabel('Hodiny pro ' + EXCEPTION_DATE).fill('9:00 - 15:00');

    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(
      page.getByText('Otevírací doba byla úspěšně uložena.')
    ).toBeVisible();

    // Verify the exception was saved by checking the UI displays it
    await expect(
      page.getByLabel(`Datum výjimky ${EXCEPTION_DATE}`)
    ).toBeVisible();
    await expect(page.getByLabel(`Hodiny pro ${EXCEPTION_DATE}`)).toHaveValue(
      '9:00 - 15:00'
    );
  });

  test('admin form loads the JSONC schedule with all day keys', async ({
    page,
  }) => {
    await stubSoftWebauthn(page, loadTestCredentials());

    await signInViaUi(page);

    // The PHP API reads opening-hours.jsonc (JSONC-tolerant) and the form
    // normalizes it: all seven day inputs render, missing keys default
    // to empty.
    await expect(page.locator('input[placeholder="9:00 - 17:00"]')).toHaveCount(
      7
    );

    // The preview renders the loaded range.
    await expect(page.getByText(/2026-01-01 → 2026-12-31/)).toBeVisible();

    // No load error banner.
    await expect(
      page.getByText(/Nepodařilo se načíst otevírací dobu/)
    ).toHaveCount(0);
  });
});
