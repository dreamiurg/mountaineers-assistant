import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

const distDir = path.resolve(process.cwd(), 'dist');
const collectJsPath = path.join(distDir, 'collect.js');

test.describe('Content script re-injection', () => {
  test('should handle double injection without syntax errors', async () => {
    // Read the collect.js file content
    const scriptContent = await fs.readFile(collectJsPath, 'utf-8');

    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: ['--headless=new'],
    });

    try {
      const page = await context.newPage();

      // Track all page errors
      const pageErrors: Error[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error);
      });

      // Navigate to a blank page
      await page.goto('data:text/html,<html><head></head><body>Test page</body></html>');

      // Inject the script by adding it as inline script (simulates chrome.scripting.executeScript)
      // First injection
      await page.evaluate((code) => {
        window.__mtgExistingActivityUids = [];
        window.__mtgFetchLimit = null;
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
      }, scriptContent);

      // Wait for any async errors
      await page.waitForTimeout(100);

      // Second injection - this would trigger the redeclaration bug
      await page.evaluate((code) => {
        window.__mtgExistingActivityUids = [];
        window.__mtgFetchLimit = null;
        window.__mtgScrapeRunning = false;
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
      }, scriptContent);

      // Wait for any async errors
      await page.waitForTimeout(100);

      // Check for syntax errors related to redeclaration
      const hasSyntaxError = pageErrors.some((error) => {
        const message = error.message.toLowerCase();
        return (
          message.includes('syntaxerror') ||
          message.includes('has already been declared') ||
          (message.includes('identifier') && message.includes('already'))
        );
      });

      if (hasSyntaxError) {
        console.log(
          'Page errors detected:',
          pageErrors.map((e) => e.message)
        );
      }

      expect(hasSyntaxError).toBe(false);

      await page.close();
    } finally {
      await context.close();
    }
  });
});
