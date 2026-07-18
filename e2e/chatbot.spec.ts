import { test, expect } from '@playwright/test';

test.describe('Chatbot PWA widget', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept API calls to api/chatbot.php to mock backend response during testing
    await page.route('**/api/chatbot.php', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = JSON.parse(request.postData() || '{}');

        // Mock validation failure for specific email
        if (postData.email === 'fail@example.com') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Mocked validation error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    // Navigate to homepage
    await page.goto('/');
  });

  test('should display the floating chatbot button and toggle the chat panel', async ({
    page,
  }) => {
    const toggleBtn = page.locator('#chatbot-toggle-btn');
    const panel = page.locator('#chatbot-panel');

    // 1. Verify button is visible
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('🍰');

    // 2. Verify panel is initially hidden (has class opacity-0 / pointer-events-none)
    await expect(panel).toHaveClass(/pointer-events-none/);

    // 3. Click to open panel
    await toggleBtn.click();
    await expect(panel).not.toHaveClass(/pointer-events-none/);

    // 4. Verify greeting is shown (default Czech language fallback)
    const greetingText = page.locator('#chatbot-panel p').first();
    await expect(greetingText).toContainText(
      'Ahoj! Vítej v naší rodinné cukrárně.'
    );

    // 5. Click close button and check if panel hides
    const closeBtn = page.locator('#chatbot-close-btn');
    await closeBtn.click();
    await expect(panel).toHaveClass(/pointer-events-none/);
  });

  test('should complete the order workflow successfully', async ({ page }) => {
    const toggleBtn = page.locator('#chatbot-toggle-btn');
    await toggleBtn.click();

    // Click "Yes"
    const yesBtn = page.locator('#chatbot-yes-btn');
    await yesBtn.click();

    // Input email
    const emailInput = page.locator('#chatbot-email-input');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('customer@example.cz');

    // Submit form
    const submitBtn = page.locator('#chatbot-submit-email-btn');
    await submitBtn.click();

    // Check success state
    const successMsg = page.locator('#chatbot-panel p');
    await expect(successMsg).toContainText(
      'Děkujeme! Odeslali jsme ti e-mail s odkazem na stažení katalogu.'
    );

    // Finish and close
    const finishBtn = page.locator('#chatbot-finish-btn');
    await finishBtn.click();
    await expect(page.locator('#chatbot-panel')).toHaveClass(
      /pointer-events-none/
    );
  });

  test('should handle decline path', async ({ page }) => {
    const toggleBtn = page.locator('#chatbot-toggle-btn');
    await toggleBtn.click();

    // Click "No"
    const noBtn = page.locator('#chatbot-no-btn');
    await noBtn.click();

    // Check decline message
    const declineMsg = page.locator('#chatbot-panel p');
    await expect(declineMsg).toContainText(
      'Dobře, kdybys změnil(a) názor, stačí kliknout na 🍰.'
    );

    // Close
    const closeBtn = page.locator('#chatbot-decline-close-btn');
    await closeBtn.click();
    await expect(page.locator('#chatbot-panel')).toHaveClass(
      /pointer-events-none/
    );
  });

  test('should display API error messages', async ({ page }) => {
    const toggleBtn = page.locator('#chatbot-toggle-btn');
    await toggleBtn.click();

    // Go to email input
    await page.locator('#chatbot-yes-btn').click();

    // Input email that triggers mock error
    await page.locator('#chatbot-email-input').fill('fail@example.cz');
    await page.locator('#chatbot-submit-email-btn').click();

    // Verify error is shown
    const errorAlert = page.locator('#chatbot-panel p');
    await expect(errorAlert).toContainText('Mocked validation error');

    // Start over button should reset to greeting
    await page.locator('#chatbot-retry-btn').click();
    await expect(page.locator('#chatbot-yes-btn')).toBeVisible();
  });
});
