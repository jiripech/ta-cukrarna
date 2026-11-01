import { test, expect } from '@playwright/test';
import type { Page as PlaywrightCorePage } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const serviceWorker = {
      register: async () => ({ scope: '/', active: null, waiting: null }),
      getRegistration: async () => null,
      ready: Promise.resolve({ active: null, waiting: null, installing: null }),
    };

    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: serviceWorker,
      configurable: true,
    });
  });
});

test.describe('Admin WCAG checks', () => {
  test('admin sign-in page has no serious accessibility issues', async ({
    page,
  }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#site-version-footer')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({
      page: page as unknown as PlaywrightCorePage,
    })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('admin registration page has no serious accessibility issues', async ({
    page,
  }) => {
    await page.goto('/admin/register/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({
      page: page as unknown as PlaywrightCorePage,
    })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
