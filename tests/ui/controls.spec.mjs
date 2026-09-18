import { test, expect } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

test('dropdown triggers reference their open menus, including symbol submenus', async ({ page, app }) => {
  const ids = new Set();
  for (const label of ['Settings', 'Export format', 'Export background', 'History', 'Insert math symbol']) {
    const trigger = page.getByRole('button', { name: label, exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.locator('[role="menu"][data-state="open"]');
    await expect(menu).toBeVisible();
    const id = await trigger.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(ids.has(id)).toBe(false);
    ids.add(id);
    await expect(menu).toHaveAttribute('id', id);
    await expect(menu).toHaveAccessibleName(label === 'Insert math symbol' ? 'Math symbols' : label);
    expect(await page.evaluate(id => document.querySelectorAll(`[id="${id}"]`).length, id)).toBe(1);
    if (label === 'Insert math symbol') {
      await page.keyboard.type('integral');
      const integral = page.getByRole('menuitem', { name: 'Integral', exact: true });
      await expect(integral).toBeFocused();
      await page.keyboard.press('ArrowRight');
      const submenu = page.getByRole('menu', { name: 'Integral variants', exact: true });
      await expect(submenu).toHaveAttribute('id', await integral.getAttribute('aria-controls'));
      await page.keyboard.press('ArrowLeft');
      await expect(integral).toBeFocused();
      await page.keyboard.type('fraction');
      await expect(page.getByRole('menuitem', { name: 'Fraction', exact: true })).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('format typeahead resets on reopening and repeated letters cycle through matches', async ({ page, app }) => {
  const trigger = page.getByRole('button', { name: 'Export format', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'PNG', exact: true })).toBeFocused();
  await page.keyboard.type('j');
  await expect(page.getByRole('menuitemradio', { name: 'JPEG', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-description', 'JPEG');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'PNG', exact: true })).toBeFocused();
  await page.keyboard.type('s');
  await expect(page.getByRole('menuitemradio', { name: 'SVG', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-description', 'SVG');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'PNG', exact: true })).toBeFocused();
  await page.keyboard.type('p');
  await expect(page.getByRole('menuitemradio', { name: 'PDF', exact: true })).toBeFocused();
  await page.keyboard.type('p');
  await expect(page.getByRole('menuitemradio', { name: 'PNG', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-description', 'SVG');
});

test('background typeahead skips disabled transparency for JPEG', async ({ page, app }) => {
  await chooseExportOption(page, 'Export format', 'JPEG');
  const trigger = page.getByRole('button', { name: 'Export background', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: 'Transparent', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitemradio', { name: 'Solid', exact: true })).toBeFocused();
  await page.keyboard.type('t');
  await expect(page.getByRole('menuitemradio', { name: 'Solid', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.type('custom');
  await expect(page.getByRole('menuitemradio', { name: 'Custom', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('Copy confirms success in place, resets, and never confirms a download fallback', async ({ page, app }) => {
  const copy = page.getByRole('button', { name: 'Copy image', exact: true });
  const status = page.locator('#preview-actions [role="status"]');
  const original = await copy.boundingBox();
  await copy.click();
  await expect(copy).toHaveText('Copied');
  await expect(copy.locator('svg.lucide-check')).toBeVisible();
  await expect(status).toHaveText('Image copied to clipboard');
  const confirmed = await copy.boundingBox();
  expect(confirmed.width).toBe(original.width);
  expect(confirmed.height).toBe(original.height);
  await expect(page.getByText('Image copied to clipboard!', { exact: true })).toHaveCount(0);
  await expect(copy).toHaveText('Copy', { timeout: 4000 });
  await expect(status).toBeEmpty();

  await copy.click();
  await expect(copy).toHaveText('Copied');
  await page.evaluate(() => {
    navigator.clipboard.write = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  const download = page.waitForEvent('download');
  await copy.click();
  expect(await (await download).failure()).toBeNull();
  await expect(copy).toBeEnabled();
  await expect(copy).toHaveText('Copy');
  await expect(status).toBeEmpty();
  await expect(page.getByText('Clipboard not supported; downloaded the image instead.', { exact: true })).toBeVisible();
});

test('history removal stays separate from loading, supports keyboard, and persists', async ({ page, app }) => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ latex: `x^{${i + 2}}`, timestamp: Date.now() - i * 60_000 }));
  await page.evaluate(entries => localStorage.setItem('equationHistory', JSON.stringify(entries)), entries);
  await page.reload();
  await app.ready();
  const source = await app.editor.innerText();
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const activate = target => touch ? target.tap() : target.click();
  const history = page.getByRole('button', { name: 'History', exact: true });
  await activate(history);
  const menu = page.getByRole('menu');
  const remove = page.getByRole('menuitem', { name: 'Remove from history', exact: true });
  await expect(remove).toHaveCount(entries.length);
  await menu.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
  const box = await menu.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
  if (touch) {
    await expect(remove.first()).toHaveCSS('opacity', '1');
    const bounds = await remove.first().boundingBox();
    expect(bounds.width).toBeCloseTo(44, 1);
    expect(bounds.height).toBeCloseTo(44, 1);
  }
  await activate(remove.first());
  await expect(remove).toHaveCount(entries.length - 1);
  await expect(menu).toBeVisible();
  await expect(app.editor).toHaveText(source);
  await expect(remove.first()).toBeFocused();
  await remove.first().press('Enter');
  await expect(remove).toHaveCount(entries.length - 2);
  await expect(app.editor).toHaveText(source);
  await page.keyboard.press('Escape');
  await page.reload();
  await app.ready();
  await activate(history);
  await expect(remove).toHaveCount(entries.length - 2);
  await activate(page.getByRole('menuitem', { name: `Load equation: ${entries.at(-1).latex}`, exact: true }));
  await expect(menu).toBeHidden();
  await expect(app.editor).toHaveText(entries.at(-1).latex);
});

test('removing the last history entry keeps the empty menu usable', async ({ page, app }) => {
  await page.evaluate(() => localStorage.setItem('equationHistory', JSON.stringify([{ latex: 'x^2', timestamp: Date.now() }])));
  await page.reload();
  await app.ready();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const remove = page.getByRole('menuitem', { name: 'Remove from history', exact: true });
  await remove.focus();
  await remove.press('Space');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByText('No history yet', { exact: true })).toBeVisible();
  await expect(app.editor).toHaveText('x');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'History', exact: true })).toBeFocused();
});
