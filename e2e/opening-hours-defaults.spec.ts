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
 * Default opening hours ("Upravit výchozí" / Edit defaults) against the REAL
 * PHP backend (Docker).
 *
 * Contract (see SPECIFICATION.md §4.3): `defaults` in opening-hours.jsonc is
 * nested by season key (`summer` / `spring`) with the seven day keys, and the
 * public homepage falls back to these day maps when no schedule entry covers
 * today. The admin modal edits and persists them through the regular save
 * endpoint.
 *
 * Gated on DOCKER_E2E=1; chromium-only like the other sign-in specs.
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

const docrootJsonc = resolve(__dirname, '..', 'out', 'opening-hours.jsonc');
const sourceJsonc = resolve(__dirname, '..', 'public', 'opening-hours.jsonc');

test.afterEach(() => writeFileSync(docrootJsonc, readFileSync(sourceJsonc)));

const SUMMER_MON = '8:00 - 12:00';
const SPRING_FRI = '7:00 - 15:00';

test('admin edits defaults and saves them into the docroot file', async ({
  page,
}) => {
  await stubSoftWebauthn(page, loadTestCredentials());
  await signInViaUi(page);

  await page.getByRole('button', { name: 'Upravit výchozí' }).click();

  await page.getByLabel('Léto Pondělí', { exact: true }).fill(SUMMER_MON);
  await page.getByLabel('Mimo léto Pátek', { exact: true }).fill(SPRING_FRI);

  // The modal's Save persists through the regular opening-hours endpoint.
  await page
    .getByRole('heading', { name: 'Výchozí otevírací doba' })
    .locator('..')
    .getByRole('button', { name: 'Uložit' })
    .click();

  await expect(
    page.getByText('Otevírací doba byla úspěšně uložena.')
  ).toBeVisible();

  // Server-side proof: the docroot file carries the nested defaults.
  const saved = JSON.parse(readFileSync(docrootJsonc, 'utf8'));
  expect(saved.defaults?.summer?.mon).toBe(SUMMER_MON);
  expect(saved.defaults?.spring?.fri).toBe(SPRING_FRI);

  // Round trip: reopening the modal shows the persisted values.
  await page.getByRole('button', { name: 'Upravit výchozí' }).click();
  await expect(page.getByLabel('Léto Pondělí', { exact: true })).toHaveValue(
    SUMMER_MON
  );
  await expect(page.getByLabel('Mimo léto Pátek', { exact: true })).toHaveValue(
    SPRING_FRI
  );
});

test('public homepage falls back to server defaults when no season covers today', async ({
  page,
}) => {
  // Fixture: schedule only in the past, defaults for both season keys.
  writeFileSync(
    docrootJsonc,
    JSON.stringify({
      schedule: [
        {
          startDate: '2020-01-01',
          endDate: '2020-12-31',
          days: {
            mon: '9:00 - 17:00',
            tue: '9:00 - 17:00',
            wed: '9:00 - 17:00',
            thu: '9:00 - 17:00',
            fri: '9:00 - 17:00',
            sat: '',
            sun: '',
          },
        },
      ],
      exceptions: [],
      defaults: {
        summer: {
          mon: '8:00 - 14:00',
          tue: '8:00 - 14:00',
          wed: '8:00 - 14:00',
          thu: '8:00 - 14:00',
          fri: '8:00 - 14:00',
          sat: '',
          sun: '',
        },
        spring: {
          mon: '',
          tue: '',
          wed: '',
          thu: '',
          fri: SPRING_FRI,
          sat: '',
          sun: '',
        },
      },
    })
  );

  // October = non-summer season -> the spring defaults apply.
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const patekRow = page
    .locator('#opening-hours > div > div')
    .filter({ hasText: 'Pátek' });
  await expect(patekRow).toContainText(SPRING_FRI);
});
