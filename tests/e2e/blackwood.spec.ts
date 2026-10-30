import { expect, test } from '@playwright/test';

test('plays Blackwood, replans at the critical pause, finishes and verifies replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('10');
  await page.getByRole('button', { name: 'Load sample plan' }).click();
  await page.getByRole('button', { name: 'Execute plan' }).click();
  const decision = page.getByRole('region', { name: 'Critical decision' });
  await expect(decision).toBeVisible();
  await expect(page.getByTestId('mission-phase')).toContainText('PAUSED');
  const paused = await page.getByTestId('mission-phase').textContent();
  await page.getByRole('combobox', { name: 'Tempo', exact: true }).selectOption('METHODICAL');
  await expect(page.getByTestId('mission-phase')).toHaveText(paused ?? '');
  await page.getByRole('button', { name: 'Prioritize civilian', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mission debrief' })).toContainText('Mission completed');
  await expect(page.getByRole('region', { name: 'Mission objectives' })).toContainText('COMPLETE · Safeguard civilian');
  const stateHash = await page.getByTestId('final-state-hash').textContent();
  await page.getByRole('button', { name: 'Replay recorded run' }).click();
  await expect(page.getByRole('button', { name: 'Queue order', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Step replay' }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Replay verified');
  await expect(page.getByTestId('final-state-hash')).toHaveText(stateHash ?? '');
  expect(errors).toEqual([]);
});

test('completes unattended in wide mode and repeats the same seed and plan exactly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('10');
  await page.getByRole('combobox', { name: 'Autonomy', exact: true }).selectOption('WIDE');
  await page.getByRole('button', { name: 'Load sample plan' }).click();
  await page.getByRole('button', { name: 'Execute plan' }).click();
  await expect(page.getByRole('region', { name: 'Mission debrief' })).toContainText('Mission completed');
  const firstHash = await page.getByTestId('final-state-hash').textContent();
  await page.getByRole('button', { name: 'Retry same seed' }).click();
  await expect(page.getByTestId('mission-phase')).toHaveText('PLANNING / TICK 0');
  await page.getByRole('button', { name: 'Load sample plan' }).click();
  await page.getByRole('button', { name: 'Execute plan' }).click();
  await expect(page.getByRole('region', { name: 'Mission debrief' })).toContainText('Mission completed');
  await expect(page.getByTestId('final-state-hash')).toHaveText(firstHash ?? '');
});

test('reports invalid commands instead of mutating the plan', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Target X').fill('0');
  await page.getByLabel('Target Y').fill('0');
  await page.getByRole('button', { name: 'Queue order', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('walkable');
  await expect(page.getByRole('region', { name: 'Order queue' })).toContainText('Select an operator');
});

test('saves and imports a versioned replay file', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('10');
  await page.getByRole('combobox', { name: 'Autonomy', exact: true }).selectOption('WIDE');
  await page.getByRole('button', { name: 'Load sample plan' }).click();
  await page.getByRole('button', { name: 'Execute plan' }).click();
  await expect(page.getByRole('region', { name: 'Mission debrief' })).toContainText('Mission completed');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save replay', exact: true }).click();
  const download = await downloadPromise;
  const replayPath = testInfo.outputPath('run.json');
  await download.saveAs(replayPath);
  await page.getByLabel('Import replay').setInputFiles(replayPath);
  await expect(page.getByRole('status')).toContainText('Read-only replay');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Replay verified');
});
