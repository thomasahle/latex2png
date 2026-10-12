import { test, expect } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

test('preview context menu supports keyboard access and returns focus after copying', async ({ page, app }) => {
  await app.setEquation(String.raw`\frac{123}{456}`);
  const menu = page.getByRole('menu', { name: 'Equation actions', exact: true });
  for (const key of ['Shift+F10', 'ContextMenu']) {
    await app.preview.focus();
    await page.keyboard.press(key);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('id', await app.preview.getAttribute('aria-controls'));
    await expect(page.getByRole('menuitem', { name: 'Save PNG', exact: true })).toBeFocused();
    await page.keyboard.type('copy');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Copy MathML', exact: true })).toBeFocused();
    if (key === 'Shift+F10') await page.keyboard.press('Escape');
    else {
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => window.copiedText)).toContain('<mfrac');
    }
    await expect(menu).toBeHidden();
    await expect(app.preview).toBeFocused();
    await expect(app.preview).not.toHaveAttribute('aria-controls');
  }
  await app.preview.press('F10');
  await expect(menu).toBeHidden();
});

test('preview context menu stays reachable at narrow and short viewport edges', async ({ page, app }, testInfo) => {
  for (const viewport of [page.viewportSize(), { width: 320, height: 568 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(viewport);
    const bounds = await app.preview.boundingBox();
    await app.preview.click({ button: 'right', position: { x: bounds.width - 8, y: bounds.height / 2 } });
    const menu = page.getByRole('menu', { name: 'Equation actions', exact: true });
    await expect(menu).toBeVisible();
    await menu.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
    const box = await menu.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press('End');
    const last = page.getByRole('menuitem', { name: 'Share Image', exact: true });
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`preview-menu-${viewport.width}x${viewport.height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }
});

test('preview arrow keys scroll large formulas after closing its context menu', async ({ page, app }, testInfo) => {
  const row = Array(12).fill('123456789').join('&');
  await app.setEquation('\\begin{matrix}' + Array(12).fill(row).join('\\\\') + '\\end{matrix}');
  await page.getByRole('slider', { name: 'Zoom level' }).fill('5');
  await app.preview.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Equation actions', exact: true });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(app.preview).toBeFocused();
  const scroll = () => app.preview.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop }));
  const before = await scroll();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await scroll()).x).toBeGreaterThan(before.x);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await scroll()).y).toBeGreaterThan(before.y);
  const moved = await scroll();
  await page.screenshot({ path: testInfo.outputPath('preview-panned.png') });
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await scroll()).x).toBeLessThan(moved.x);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await scroll()).y).toBeLessThan(moved.y);
  await expect(app.preview).toBeFocused();
});

for (const [theme, background, ink] of [['light', '#000000', '255'], ['dark', '#ffffff', '0']]) {
  test(`custom backgrounds keep formulas, controls, and exported ink legible in ${theme} mode`, async ({ page, app }, testInfo) => {
    await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
    await page.reload();
    await app.setEquation(String.raw`x+{\color{red}y}`);
    await page.getByRole('slider', { name: 'Zoom level' }).fill('3');
    await chooseExportOption(page, 'Export background', 'Custom');
    await page.getByLabel('Custom background color', { exact: true }).fill(background);
    await page.keyboard.press('Escape');
    const color = `rgb(${ink}, ${ink}, ${ink})`;
    await expect(page.locator('#math-preview')).toHaveCSS('color', color);
    await expect(page.locator('#preview-toolbar')).toHaveCSS('color', color);
    await expect(page.locator('#preview-toolbar .floating-surface').last()).toHaveCSS('color', color);
    await page.screenshot({ path: testInfo.outputPath('custom-background.png') });

    const png = await app.save('PNG');
    const jpeg = await app.save('JPEG');
    for (const [format, bytes] of [['png', png], ['jpeg', jpeg]]) {
      const inkPixels = await page.evaluate(async ({ bytes, format, ink }) => {
        const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: `image/${format}` }));
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if ([0, 1, 2].every(channel => Math.abs(pixels[i + channel] - Number(ink)) < 10)) count++;
        }
        return count;
      }, { bytes: [...bytes], format, ink });
      expect(inkPixels, `${format} contains contrasting formula pixels`).toBeGreaterThan(40);
    }
    const svg = (await app.save('SVG')).toString();
    expect(svg).toContain(`color="${ink === '0' ? '#000000' : '#ffffff'}"`);
    expect(svg).toContain('fill="red"');
    await page.getByRole('button', { name: 'Copy image', exact: true }).click();
    await page.waitForFunction(() => window.copiedItems.length);
    const copied = await page.evaluate(async () => [...new Uint8Array(await (await window.copiedItems[0].getType('image/png')).arrayBuffer())]);
    expect(Buffer.from(copied)).toEqual(png);
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.complete);
    const dragged = await page.locator('#formula-drag-image').evaluate(async el => [...new Uint8Array(await (await fetch(el.src)).arrayBuffer())]);
    expect(Buffer.from(dragged)).toEqual(png);

    // Returning to a theme background restores its normal ink and controls.
    await chooseExportOption(page, 'Export background', 'Solid');
    const normalColor = theme === 'light' ? 'rgb(10, 10, 10)' : 'rgb(238, 238, 238)';
    await expect(page.locator('#math-preview')).toHaveCSS('color', normalColor);
    await expect(page.locator('#preview-toolbar')).toHaveCSS('color', normalColor);
  });
}

test('dropdown triggers reference their open menus, including symbol submenus', async ({ page, app }) => {
  const ids = new Set();
  for (const label of ['Settings', 'Export format', 'Export background', 'History', 'Share', 'Insert math symbol']) {
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
  const png = page.getByRole('menuitemradio', { name: 'PNG', exact: true });
  async function openWithKeyboard() {
    await page.keyboard.press('Enter');
    await expect(png).toBeFocused();
    // bits-ui focuses the first item again a tick after the content gains
    // focus. On a slow runner that lands after the next keystroke and takes
    // focus back from the typeahead match, so let the open settle first.
    await page.waitForTimeout(250);
    await expect(png).toBeFocused();
  }
  await trigger.focus();
  await openWithKeyboard();
  await page.keyboard.type('j');
  await expect(page.getByRole('menuitemradio', { name: 'JPEG', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-description', 'JPEG');
  await expect(trigger).toBeFocused();
  await openWithKeyboard();
  await page.keyboard.type('s');
  await expect(page.getByRole('menuitemradio', { name: 'SVG', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-description', 'SVG');
  await expect(trigger).toBeFocused();
  await openWithKeyboard();
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

test('history merges exports across tabs and updates an open menu without replacing either draft', async ({ page, app, context }) => {
  const other = await context.newPage();
  try {
    await other.route('https://**/*', route => route.abort());
    await other.goto(new URL('?latex=y%5E3', page.url()).href);
    await other.locator('#math-preview svg').waitFor();
    await page.bringToFront();
    await app.setEquation('x^2');
    await expect(app.editor).toHaveText('x^2');
    let downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
    expect(await (await downloading).failure()).toBeNull();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Load equation: x^2', exact: true })).toBeVisible();

    await other.bringToFront();
    downloading = other.waitForEvent('download');
    await other.getByRole('button', { name: 'Download PNG', exact: true }).click();
    expect(await (await downloading).failure()).toBeNull();
    await expect(page.getByRole('menuitem', { name: /^Load equation:/ })).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Load equation: y^3', exact: true })).toBeVisible();
    await expect(app.editor).toHaveText('x^2');
    await expect(other.getByRole('textbox', { name: 'LaTeX equation' })).toHaveText('y^3');

    await other.getByRole('button', { name: 'History', exact: true }).click();
    const firstTabEntry = other.getByRole('menuitem', { name: 'Load equation: x^2', exact: true }).locator('..');
    await firstTabEntry.getByRole('menuitem', { name: 'Remove from history', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Load equation:/ })).toHaveCount(1);
    await expect(page.getByRole('menuitem', { name: 'Load equation: y^3', exact: true })).toBeVisible();
    await page.bringToFront();
    await page.reload();
    await app.ready();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^Load equation:/ })).toHaveCount(1);
    await expect(page.getByRole('menuitem', { name: 'Load equation: y^3', exact: true })).toBeVisible();
  } finally { await other.close(); }
});

test('history entries saved in the same millisecond remain distinct', async ({ page, app }) => {
  await page.evaluate(() => localStorage.setItem('equationHistory', JSON.stringify([
    { latex: 'x^2', timestamp: 1234567890 },
    { latex: 'y^3', timestamp: 1234567890 },
  ])));
  await page.reload();
  await app.ready();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /^Load equation:/ })).toHaveCount(2);
  const x = page.getByRole('menuitem', { name: 'Load equation: x^2', exact: true });
  const y = page.getByRole('menuitem', { name: 'Load equation: y^3', exact: true });
  await expect(x.locator('.history-preview svg')).toBeVisible();
  await expect(y.locator('.history-preview svg')).toBeVisible();
  await x.locator('..').getByRole('menuitem', { name: 'Remove from history', exact: true }).click();
  await expect(x).toHaveCount(0);
  await y.click();
  await expect(app.editor).toHaveText('y^3');
});

test('history renders each preview once across rapid menu reopenings', async ({ page, app }) => {
  const equations = Array.from({ length: 5 }, (_, i) => `x^{${i + 2}}`);
  await page.evaluate(equations => localStorage.setItem('equationHistory', JSON.stringify(
    equations.map((latex, i) => ({ latex, timestamp: Date.now() - i })),
  )), equations);
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.historyRenderRequests = [];
    window.Worker = class extends NativeWorker {
      postMessage(message, ...options) {
        if (message.type === 'render' && !message.display) window.historyRenderRequests.push(message.latex);
        return super.postMessage(message, ...options);
      }
    };
  });
  await page.reload();
  await app.ready();
  const trigger = page.getByRole('button', { name: 'History', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.historyRenderRequests.length)).toBeGreaterThan(0);
  // Reopen while the fixture's slow worker still has a preview in flight.
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-preview svg')).toHaveCount(equations.length);
  expect((await page.evaluate(() => window.historyRenderRequests)).sort()).toEqual(equations.sort());
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-preview svg')).toHaveCount(equations.length);
  expect(await page.evaluate(() => window.historyRenderRequests.length)).toBe(equations.length);
});
