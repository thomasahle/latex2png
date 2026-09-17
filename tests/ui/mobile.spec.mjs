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

test('touch zoom and fullscreen work in portrait and landscape', async ({ page, app }) => {
  await app.setEquation(formula);
  await expect(page.getByRole('button', { name: 'Toggle layout orientation' })).toBeHidden();
  const slider = page.getByRole('slider', { name: 'Zoom level' });
  await slider.tap({ position: { x: 60, y: 2 } });
  expect(Number(await slider.inputValue())).toBeGreaterThan(1.5);
  await slider.fill('5');
  await expect(app.preview).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).tap();
  const portrait = page.viewportSize();
  for (const size of [portrait, { width: portrait.height, height: portrait.width }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
    const layout = await page.evaluate(() => {
      const preview = document.querySelector('#preview-scroll');
      const controls = [...document.querySelectorAll('#preview-toolbar button, #preview-toolbar input')];
      return { width: document.documentElement.scrollWidth, viewport: innerWidth,
        previewHeight: preview.clientHeight,
        controlsOnTop: controls.every(control => {
          const r = control.getBoundingClientRect();
          return !r.width || control.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }) };
    });
    expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.previewHeight).toBeGreaterThan(40);
    expect(layout.controlsOnTop).toBe(true);
  }
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).tap();
  await expect(page.getByRole('separator', { name: 'Resize workspace height' })).toBeVisible();
});

test('both resizers accept touch focus and preserve pointer changes on reload', async ({ page, app }) => {
  const values = [];
  for (const name of ['Resize editor and preview', 'Resize workspace height']) {
    const handle = page.getByRole('separator', { name, exact: true });
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
    values.push({ name, value: String(after) });
  }
  await page.reload();
  await app.ready();
  for (const { name, value } of values) {
    await expect(page.getByRole('separator', { name, exact: true })).toHaveAttribute('aria-valuenow', value);
  }
});

test('Android native touch gestures resize both handles', async ({ page, context, browserName, app }) => {
  test.skip(browserName !== 'chromium', 'Native swipe injection uses the Chromium DevTools protocol.');
  const touch = await context.newCDPSession(page);
  for (const name of ['Resize editor and preview', 'Resize workspace height']) {
    const handle = page.getByRole('separator', { name, exact: true });
    await handle.scrollIntoViewIfNeeded();
    const bounds = await handle.boundingBox();
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const before = Number(await handle.getAttribute('aria-valuenow'));
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 20 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
  }
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
