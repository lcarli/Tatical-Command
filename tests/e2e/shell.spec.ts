import { expect, test } from '@playwright/test';

test('shows the titled shell and one Phaser canvas without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  const loadedCharacters = new Set<string>();
  page.on('response', (response) => {
    if (response.ok() && response.url().includes('/assets/blackwood/characters/')) loadedCharacters.add(response.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('TACTICAL COMMAND');
  await expect(page.getByRole('heading', { name: 'TACTICAL COMMAND', exact: true })).toBeVisible();
  await expect(page.getByTestId('mission-phase')).toContainText('PLANNING');
  const viewport = page.getByTestId('game-viewport');
  await expect(viewport).toBeVisible();
  await expect(viewport.locator('canvas')).toHaveCount(1);
  await expect(viewport.locator('canvas')).toBeVisible();
  await expect.poll(() => loadedCharacters.size).toBe(4);
  expect(errors).toEqual([]);
});

test('selects on the map, queues an intent and executes immutable snapshots', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('game-viewport').locator('canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Canvas bounds unavailable.');
  await canvas.click({ position: { x: 276 / 960 * bounds.width, y: 258 / 540 * bounds.height } });
  await expect(page.getByRole('button', { name: /Bravo 2/ })).toHaveAttribute('aria-pressed', 'true');
  await canvas.click({ position: { x: 650 / 960 * bounds.width, y: 249 / 540 * bounds.height } });
  await expect(page.getByLabel('Target X')).toHaveValue('7');
  await expect(page.getByLabel('Target Y')).toHaveValue('2');
  await page.getByRole('combobox', { name: 'Order', exact: true }).selectOption('INSPECT');
  await page.getByRole('button', { name: 'Queue order', exact: true }).click();
  await expect(page.getByLabel('Order queue')).toContainText('bravo-2 · INSPECT · QUEUED');
  await page.getByRole('button', { name: 'Execute plan' }).click();
  await expect(page.getByTestId('mission-phase')).toContainText('EXECUTING');
  await expect(page.getByLabel('Order queue')).toContainText('ACTIVE');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('mission-phase')).toContainText('PAUSED');
});

test('fits the canvas and command controls in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const canvas = page.getByTestId('game-viewport').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeLessThan(375);
  await expect(page.getByRole('button', { name: 'Load sample plan' })).toBeVisible();
});
