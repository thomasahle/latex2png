import { test, expect, formula, baseUrl } from './fixtures.mjs';

async function chooseByTouch(page, label, option) {
  await page.getByRole('button', { name: label, exact: true }).tap();
  const menu = page.locator('[role="menu"][data-state="open"]');
  const bounds = await menu.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole('menuitemradio', { name: option, exact: true }).tap();
  await expect(menu).toBeHidden();
}

test('compact export bar stays on one row and its controls work by touch', async ({ page, app }) => {
  for (const width of [320, 390, 568]) {
    await page.setViewportSize({ width, height: 844 });
    for (const background of ['Transparent', 'Solid', 'Custom']) {
      await chooseByTouch(page, 'Export background', background);
      if (background === 'Custom') await page.getByLabel('Custom background color', { exact: true }).fill('#2060c0');
      await expect(page.getByRole('button', { name: 'Export background', exact: true })).toHaveAttribute('aria-description', background);
      const boxes = await page.locator('#preview-actions button').evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        return { top: box.top, left: box.left, right: box.right, width: box.width, height: box.height };
      }));
      expect(boxes).toHaveLength(4);
      for (const box of boxes) {
        expect(Math.abs(box.top - boxes[0].top)).toBeLessThan(1);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.left).toBeGreaterThanOrEqual(10);
        expect(box.right).toBeLessThanOrEqual(width - 10);
      }
    }
  }
  await page.getByRole('button', { name: 'Copy image', exact: true }).tap();
  await page.waitForFunction(() => window.copiedItems.length === 1);
  const copied = await page.evaluate(async () => {
    const blob = await window.copiedItems[0].getType('image/png');
    return { type: blob.type, size: blob.size };
  });
  expect(copied.type).toBe('image/png');
  expect(copied.size).toBeGreaterThan(100);
});

for (const format of ['PNG', 'JPEG', 'SVG', 'PDF']) {
  test(`touch menus export ${format} with custom background`, async ({ page, app }) => {
    await app.setEquation(formula);
    await chooseByTouch(page, 'Export format', format);
    await chooseByTouch(page, 'Export background', 'Custom');
    await page.getByLabel('Custom background color', { exact: true }).fill('#2060c0');
    await expect(app.preview).toHaveCSS('background-color', 'rgb(32, 96, 192)');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}`, exact: true }).tap();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(`latex-equation.${format === 'JPEG' ? 'jpg' : format.toLowerCase()}`);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    expect(Buffer.concat(chunks).length).toBeGreaterThan(100);
  });
}

test('symbols insert by touch and the menu stays inside the phone viewport', async ({ page, app }) => {
  await page.getByRole('button', { name: 'Insert math symbol', exact: true }).tap();
  const bounds = await page.locator('[role="menu"][data-state="open"]').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByTitle('Square root', { exact: true }).tap();
  await expect(app.editor).toContainText('\\sqrt');
  await app.ready();
});

test('mobile stays fullscreen with no exit control in portrait and landscape', async ({ page, app }) => {
  await app.setEquation(formula);
  await expect(page.getByRole('button', { name: 'Toggle layout orientation' })).toBeHidden();
  const slider = page.getByRole('slider', { name: 'Zoom level' });
  await slider.tap({ position: { x: 60, y: 2 } });
  expect(Number(await slider.inputValue())).toBeGreaterThan(1.5);
  await slider.fill('5');
  await expect(app.preview).toHaveAttribute('aria-busy', 'false');
  const portrait = page.viewportSize();
  for (const size of [portrait, { width: portrait.height, height: portrait.width }, portrait]) {
    await page.setViewportSize(size);
    await expect(page.locator('.fullscreen-app')).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Enter|Exit) fullscreen$/ })).toHaveCount(0);
    await expect(page.getByRole('separator', { name: 'Resize workspace height' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).tap();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /fullscreen/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fullscreen-app')).toBeVisible();
    const layout = await page.evaluate(() => {
      const preview = document.querySelector('#preview-scroll');
      const actions = document.querySelector('#preview-actions').getBoundingClientRect();
      const controls = [...document.querySelectorAll('#preview-toolbar button, #preview-toolbar input')];
      return { width: document.documentElement.scrollWidth, viewport: innerWidth,
        previewHeight: preview.clientHeight, actionsBottom: actions.bottom, viewportHeight: innerHeight,
        controlsOnTop: controls.every(control => {
          const r = control.getBoundingClientRect();
          return !r.width || control.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }) };
    });
    expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.previewHeight).toBeGreaterThan(40);
    expect(layout.controlsOnTop).toBe(true);
    expect(Math.abs(layout.actionsBottom - layout.viewportHeight)).toBeLessThan(1);
  }
  // A previous visit's desktop preference must not allow mobile to exit fullscreen.
  for (const preference of [false, true]) {
    await page.evaluate(value => localStorage.setItem('fullscreen', JSON.stringify(value)), preference);
    await page.reload();
    await app.ready();
    await expect(page.locator('.fullscreen-app')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fullscreen-app')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('fullscreen'))).toBe(String(preference));
  }
});

test('the mobile pane resizer accepts touch focus and preserves changes on reload', async ({ page, app }) => {
  const handle = page.getByRole('separator', { name: 'Resize editor and preview', exact: true });
  await handle.tap();
  await expect(handle).toHaveCSS('touch-action', 'none');
  await expect(handle).toHaveCSS('outline-style', 'none');
  const before = Number(await handle.getAttribute('aria-valuenow'));
  const bounds = await handle.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  const after = Number(await handle.getAttribute('aria-valuenow'));
  expect(after).toBeGreaterThan(before);
  await page.reload();
  await app.ready();
  await expect(handle).toHaveAttribute('aria-valuenow', String(after));
});

test('thin dividers can be grabbed throughout their enlarged touch area', async ({ page, app }) => {
  const handle = page.getByRole('separator', { name: 'Resize editor and preview', exact: true });
  for (const vertical of [false, true]) {
    if (vertical) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.getByRole('button', { name: 'Toggle layout orientation' }).tap();
    }
    for (const offset of [-16, 25]) {
      const bounds = await handle.boundingBox();
      expect(vertical ? bounds.width : bounds.height).toBe(10);
      const point = vertical
        ? { x: bounds.x + offset, y: bounds.y + bounds.height / 2 }
        : { x: bounds.x + bounds.width / 2, y: bounds.y + offset };
      expect(await handle.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), point)).toBe(true);
      const before = Number(await handle.getAttribute('aria-valuenow'));
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + (vertical ? 20 : 0), point.y + (vertical ? 0 : 20), { steps: 4 });
      await page.mouse.up();
      expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
      await handle.press('Enter');
    }
    // Enlarged targets must not cover the nearby floating controls.
    expect(await page.locator('#preview-toolbar button, #preview-toolbar input').evaluateAll(controls => controls.every(el => {
      const box = el.getBoundingClientRect();
      return !box.width || el.contains(document.elementFromPoint(box.left + 1, box.top + box.height / 2));
    }))).toBe(true);
  }
});

test('Android native touch gestures resize the editor and preview', async ({ page, context, browserName, app }) => {
  test.skip(browserName !== 'chromium', 'Native swipe injection uses the Chromium DevTools protocol.');
  const touch = await context.newCDPSession(page);
  const handle = page.getByRole('separator', { name: 'Resize editor and preview', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const bounds = await handle.boundingBox();
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y - 12 };
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 20 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
  await touch.detach();
});

test('an immediate page departure saves the mobile edit and zoom', async ({ page, app }) => {
  await app.editor.fill('x^3');
  await page.getByRole('slider', { name: 'Zoom level' }).fill('2.7');
  await page.goto('about:blank');
  await page.goto(baseUrl);
  await app.ready();
  await expect(app.editor).toHaveText('x^3');
  await expect(page.getByRole('slider', { name: 'Zoom level' })).toHaveValue('2.7');
});
