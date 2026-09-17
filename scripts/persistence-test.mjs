#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { chooseExportOption } from './export-controls.mjs';

const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
const profile = await mkdtemp(path.join(tmpdir(), 'latex2png-persistence-'));
let context;

async function visit() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1280, height: 844 },
  });
  // Keep external counters and analytics out of this local regression test.
  await context.route('https://**/*', route => route.abort());
  const page = context.pages()[0];
  await page.goto(`${baseUrl}?latex=x`);
  await page.locator('#math-preview mjx-container svg').waitFor();
  return {
    page,
    split: page.getByRole('separator', { name: 'Resize editor and preview', exact: true }),
    height: page.getByRole('separator', { name: 'Resize workspace height', exact: true }),
    toggle: page.getByRole('button', { name: 'Toggle layout orientation', exact: true }),
  };
}

async function closeBrowser() {
  await context.close();
  context = null;
}

async function assertSize(controls, split, height) {
  assert.equal(await controls.split.getAttribute('aria-valuenow'), String(split));
  assert.equal(await controls.height.getAttribute('aria-valuenow'), String(height));
  assert.equal((await controls.page.locator('#equation-workspace').boundingBox()).height, height);
  const axis = await controls.split.getAttribute('aria-orientation') === 'vertical' ? 'width' : 'height';
  const editor = await controls.page.locator('#editor-pane').boundingBox();
  const preview = await controls.page.locator('#preview-pane').boundingBox();
  const actualSplit = 100 * editor[axis] / (editor[axis] + preview[axis]);
  assert.ok(Math.abs(actualSplit - split) < .1, 'rendered pane sizes match the saved split');
}

try {
  let current = await visit();
  await chooseExportOption(current.page, 'Export background', 'Custom');
  await current.page.getByLabel('Custom background color', { exact: true }).fill('#2060c0');
  await current.page.keyboard.press('Escape');
  await current.split.press('ArrowDown');
  await current.split.press('ArrowDown');
  await current.height.press('Shift+ArrowDown');
  await assertSize(current, 60, 600);
  await current.toggle.click();
  await current.split.press('ArrowRight');
  await assertSize(current, 55, 600);
  await closeBrowser();

  // Reopen the actual browser profile, without copying storage into a new
  // context: this must work across visits, not just an in-memory reload.
  current = await visit();
  assert.match(await current.page.getByRole('button', { name: 'Export background', exact: true }).textContent(), /Custom/);
  assert.equal(await current.page.getByLabel('Custom background color', { exact: true }).inputValue(), '#2060c0', 'custom color survives browser restart');
  assert.equal(await current.page.locator('#preview-scroll').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(32, 96, 192)', 'preview restores the saved custom color');
  assert.equal(await current.split.getAttribute('aria-orientation'), 'vertical');
  await assertSize(current, 55, 600);
  await current.toggle.click();
  await assertSize(current, 60, 600);
  await current.split.press('Enter');
  await current.height.press('Enter');
  await closeBrowser();

  current = await visit();
  assert.equal(await current.split.getAttribute('aria-orientation'), 'horizontal');
  await assertSize(current, 50, 500);
  await current.toggle.click();
  await assertSize(current, 55, 500);
  console.log('Persistence: both resizers, separate layout splits, resets, and custom export color survive browser restarts.');
} finally {
  if (context) await closeBrowser();
  await rm(profile, { recursive: true, force: true });
}
