import { expect, type BrowserContext, type Page } from '@playwright/test';
import { test } from '../fixtures/extension-harness.js';

test.describe.configure({ mode: 'serial' });

test.describe('Insights dashboard visual snapshots', () => {
  const openInsightsPage = async (context: BrowserContext, extensionId: string) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/insights.html`);
    await page.waitForSelector('text=Activity Insights Dashboard', { state: 'visible' });
    await page.waitForSelector('text=Recent activities', { state: 'visible' });
    await page.addStyleTag({
      content: 'body { scrollbar-width: none; } body::-webkit-scrollbar { display: none; }',
    });
    return page;
  };

  type FilterOverrides = Partial<Record<'activityType' | 'category' | 'role', string[]>>;

  const applyDashboardFilters = async (page: Page, overrides: FilterOverrides) => {
    await page.evaluate((next) => {
      window.mountaineersDashboard?.setFilters(next);
    }, overrides);

    await page.waitForFunction((expected) => {
      const current = window.mountaineersDashboard?.getFilters();
      if (!current) {
        return false;
      }
      return Object.entries(expected).every(([key, value]) => {
        if (!value || !Array.isArray(value)) {
          return true;
        }
        const active = current[key as keyof typeof current];
        if (!Array.isArray(active) || active.length !== value.length) {
          return false;
        }
        return active.every((entry, index) => entry === value[index]);
      });
    }, overrides);
  };

  test('renders default analytics', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    await expect(page).toHaveScreenshot('insights-default.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('shows activity filter dropdown', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    const activityTypeChoices = page.locator('label:has-text("Activity type") .choices');
    await activityTypeChoices.locator('.choices__inner').click();
    await expect(activityTypeChoices).toHaveAttribute('class', /is-open/);
    await expect(page).toHaveScreenshot('insights-filter-dropdown.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('applies targeted filters', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    await applyDashboardFilters(page, {
      activityType: ['Climbing'],
      category: ['course'],
      role: ['Instructor'],
    });
    await expect(page.locator('text=No activities match the current filters')).toBeHidden();
    await expect(page).toHaveScreenshot('insights-filtered.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('shows empty state when filters exclude activities', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    await applyDashboardFilters(page, {
      activityType: ['Trail Running'],
      category: ['trip'],
      role: ['Instructor'],
    });
    await page.waitForSelector(
      'text=No activities match the current filters. Adjust selections to see insights.',
      { state: 'visible' }
    );
    await expect(page).toHaveScreenshot('insights-filter-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });
});
