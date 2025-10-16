import { expect } from '@playwright/test';
import { test } from '../fixtures/extension-harness.js';

test.describe.configure({ mode: 'serial' });

test.describe('Preferences visual snapshots', () => {
  test('renders seeded cache view', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${extensionId}/preferences.html`);
    await page.waitForSelector('text=Preferences', { state: 'visible' });
    await page.waitForSelector('text=Cached Activities Data', { state: 'visible' });
    await expect(page).toHaveScreenshot('preferences.png', { fullPage: true });
    await page.close();
  });
});
