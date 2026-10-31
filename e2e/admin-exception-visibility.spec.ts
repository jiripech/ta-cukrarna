import { test, expect } from '@playwright/test';
import {
  loadTestCredentials,
  resetPasskeyCounter,
  signInViaUi,
  stubSoftWebauthn,
} from './helpers/soft-webauthn';

test.use({ timezoneId: 'Europe/Prague' });

test.describe('admin exception form visibility', () => {
  test.skip(!process.env.DOCKER_E2E, 'requires Docker PHP backend');
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');

  test.beforeEach(() => resetPasskeyCounter());

  test('exception inputs are readable and usable', async ({ page }) => {
    await stubSoftWebauthn(page, loadTestCredentials());
    await signInViaUi(page);

    await page.getByRole('button', { name: 'Přidat výjimku' }).click();

    const dateInput = page.locator('[id^="ex-date-"]').last();
    const hoursInput = page.locator('[id^="ex-hours-"]').last();

    await expect(dateInput).toBeVisible();
    await expect(hoursInput).toBeVisible();
    await expect(dateInput).toBeEnabled();
    await expect(hoursInput).toBeEnabled();

    // Size checks – inputs must be long enough to type
    const [dateBox, hoursBox] = await Promise.all([
      dateInput.boundingBox(),
      hoursInput.boundingBox(),
    ]);
    expect(dateBox).not.toBeNull();
    expect(hoursBox).not.toBeNull();
    expect(dateBox!.width).toBeGreaterThan(120);
    expect(hoursBox!.width).toBeGreaterThan(120);
    expect(dateBox!.height).toBeGreaterThanOrEqual(32);
    expect(hoursBox!.height).toBeGreaterThanOrEqual(32);
    // Usability: inputs must not overlap
    const boxesOverlap = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ) => {
      return !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      );
    };
    expect(boxesOverlap(dateBox!, hoursBox!)).toBeFalsy();

    // Readability checks
    const checkReadable = async (
      locator: ReturnType<typeof page.getByLabel>
    ) => {
      const metrics = await locator.evaluate(el => {
        const cs = getComputedStyle(el);
        const toRgb = (v: string) => {
          const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m
            ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
            : [0, 0, 0];
        };
        const rgbText = toRgb(cs.color);
        const rgbBg = toRgb(cs.backgroundColor);
        const lum = (r: number, g: number, b: number) => {
          const srgb = [r, g, b].map(c => {
            const s = c / 255;
            return s <= 0.03928
              ? s / 12.92
              : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
        };
        const L1 = lum(rgbText[0], rgbText[1], rgbText[2]);
        const L2 = lum(rgbBg[0], rgbBg[1], rgbBg[2]);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        return {
          fontSize: parseFloat(cs.fontSize),
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          contrast: ratio,
        };
      });
      expect(metrics.fontSize).toBeGreaterThanOrEqual(14);
      expect(metrics.contrast).toBeGreaterThanOrEqual(4.5);
      return metrics;
    };

    await checkReadable(dateInput);
    await checkReadable(hoursInput);

    await dateInput.fill('2026-01-09');
    await hoursInput.fill('9:00 - 15:00');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(
      page.getByText('Otevírací doba byla úspěšně uložena.')
    ).toBeVisible();
  });
});
