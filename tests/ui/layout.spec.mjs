import assert from 'node:assert/strict';
import { test, formula } from './fixtures.mjs';

for (const width of [320, 390, 480, 640, 768, 1280]) {
  test(`preview layout at ${width}px supports 1–5x zoom`, async ({ page, app }) => {
    const { preview, setEquation, save } = app;
    await setEquation(formula);
    await page.setViewportSize({ width, height: 844 });
    let unscaledMath;
    for (const scale of ['1', '1.5', '3.4', '3.8', '5']) {
      await page.getByRole('slider', { name: 'Zoom level' }).fill(scale);
      // Wait for the zoom layout effect, then measure the actual scroll area.
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const bounds = await page.evaluate(() => {
        const box = id => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
        };
        const scroll = document.getElementById('preview-scroll');
        const math = document.querySelector('#math-preview svg').getBoundingClientRect();
        const controlsOnTop = [...document.querySelectorAll('#preview-toolbar button, #preview-toolbar input')].every(control => {
          const r = control.getBoundingClientRect();
          if (!r.width || !r.height) return true;
          return control.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        const pane = box('preview-pane');
        const padding = getComputedStyle(scroll);
        return { toolbar: box('preview-toolbar'), scroll: box('preview-scroll'), actions: box('preview-actions'),
          pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
          controlsOnTop, centered: Math.abs((math.top + math.bottom - pane.top - pane.bottom) / 2) < 1,
          fitsVertically: math.height + parseFloat(padding.paddingTop) + parseFloat(padding.paddingBottom) <= scroll.clientHeight,
          horizontallyCentered: Math.abs((math.left + math.right - pane.left - pane.right) / 2) < 1,
          fitsHorizontally: math.width + parseFloat(padding.paddingLeft) + parseFloat(padding.paddingRight) <= scroll.clientWidth,
          topReachable: math.top >= scroll.getBoundingClientRect().top,
          canScroll: scroll.scrollWidth > scroll.clientWidth,
          math: { width: math.width, height: math.height } };
      });
      if (scale === '1') unscaledMath = bounds.math;
      for (const dimension of ['width', 'height']) {
        assert.ok(Math.abs(bounds.math[dimension] - unscaledMath[dimension] * Number(scale)) < 1,
          `formula ${dimension} scales linearly at ${width}px/${scale}×`);
      }
      assert.ok(bounds.controlsOnTop, `floating controls remain clickable at ${width}/${scale}`);
      if (bounds.fitsVertically) assert.ok(bounds.centered, `equation vertically centered at ${width}/${scale}`);
      else assert.ok(bounds.topReachable, `tall equation starts inside the scroll region at ${width}/${scale}`);
      if (bounds.fitsHorizontally) assert.ok(bounds.horizontallyCentered, `equation horizontally centered at ${width}/${scale}`);
      assert.ok(bounds.scroll.bottom <= bounds.actions.top + 1, `save clear at ${width}/${scale}`);
      assert.ok(bounds.scroll.height > 40, 'preview retains usable space');
      assert.ok(bounds.pageWidth <= bounds.viewportWidth + 1, 'wide equations scroll inside the preview');
      const controlsFit = await page.locator('#preview-actions').evaluate(bar => {
        const bounds = bar.getBoundingClientRect();
        return [...bar.querySelectorAll('select, button')].every(control => {
          const box = control.getBoundingClientRect();
          return box.left >= bounds.left + 9 && box.right <= bounds.right - 9;
        });
      });
      assert.ok(controlsFit, `export controls retain padding at ${width}px`);
      if (width <= 390 && scale === '5') assert.ok(bounds.canScroll, 'oversized equation remains scrollable');
    }
  });
}

test("side by side fullscreen keeps preview usable", async ({ page, app }) => {
  const { editor, preview } = app;
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  assert.equal(await page.getByRole('separator', { name: 'Resize editor and preview' }).getAttribute('aria-orientation'), 'vertical');
  const previewBox = await preview.boundingBox();
  assert.ok(previewBox.height > 100, 'side by side fullscreen preview remains usable');
});

test("pane sizes persist separately without remounting editor or changing exports", async ({ page, app }) => {
  const { editor, preview, ready, setEquation, save } = app;
  await setEquation(formula);
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  await page.getByRole('slider', { name: 'Zoom level' }).fill('1.5');
  const beforeResize = await save('PNG');
  const divider = page.getByRole('separator', { name: 'Resize editor and preview' });
  await divider.press('ArrowRight');
  assert.equal(await divider.getAttribute('aria-valuenow'), '55');
  const currentEditor = await editor.elementHandle();
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  assert.equal(await divider.getAttribute('aria-valuenow'), '50', 'stacked has its own split');
  await divider.press('ArrowDown');
  await divider.press('ArrowDown');
  assert.equal(await divider.getAttribute('aria-valuenow'), '60');
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  assert.equal(await divider.getAttribute('aria-valuenow'), '55', 'side by side split restored');
  assert.equal(await currentEditor.evaluate(node => node.isConnected), true, 'editor stays mounted across modes');
  assert.equal(await editor.innerText(), formula);
  assert.deepEqual(await save('PNG'), beforeResize, 'pane resize does not change export pixels');
  await page.waitForFunction(() => JSON.parse(localStorage.paneSizes || '{}').horizontal?.[0] === 55);
  await page.reload();
  await ready();
  assert.equal(await divider.getAttribute('aria-valuenow'), '55', 'split survives reload');
  await divider.dblclick();
  assert.equal(await divider.getAttribute('aria-valuenow'), '50', 'double-click restores balanced panes');
  await divider.press('ArrowLeft');
  await divider.press('Enter');
  assert.equal(await divider.getAttribute('aria-valuenow'), '50', 'keyboard reset restores balanced panes');
});

test("resizers share focus, pointer cancellation, keyboard bounds and reset", async ({ page, app }) => {
  const { editor, preview } = app;
  const divider = page.getByRole('separator', { name: 'Resize editor and preview' });
  const workspace = page.locator('#equation-workspace');
  const heightHandle = page.getByRole('separator', { name: 'Resize workspace height', exact: true });

  // Both handles share pointer/keyboard behavior and keep focus on the grip,
  // without drawing a large outline around the entire workspace edge.
  const focusStyle = handle => handle.evaluate(el => {
    const bar = getComputedStyle(el);
    const grip = getComputedStyle(el.querySelector('[aria-hidden="true"]'));
    return { height: el.getBoundingClientRect().height, outline: bar.outlineStyle,
      shadow: bar.boxShadow, gripColor: grip.backgroundColor, gripOutlineStyle: grip.outlineStyle, gripOutlineWidth: grip.outlineWidth };
  });
  const keyboardStyles = [];
  for (const handle of [divider, heightHandle]) {
    await handle.press('ArrowDown');
    const focused = await focusStyle(handle);
    assert.equal(focused.height, 10);
    assert.equal(focused.outline, 'none', 'keyboard focus does not outline the entire bar');
    assert.equal(focused.shadow, 'none', 'keyboard focus does not ring the entire bar');
    assert.equal(focused.gripOutlineStyle, 'solid', 'keyboard focus remains visible on the grip');
    assert.equal(focused.gripOutlineWidth, '2px');
    keyboardStyles.push(focused);
    await handle.click();
    assert.equal((await focusStyle(handle)).gripOutlineStyle, 'none', 'pointer focus has no keyboard highlight');
    const startValue = await handle.getAttribute('aria-valuenow');
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20, { steps: 4 });
    assert.notEqual(await handle.getAttribute('aria-valuenow'), startValue, 'drag updates the value');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await handle.getAttribute('aria-valuenow'), startValue, 'Escape cancels either drag');
    await handle.press('Enter');
  }
  assert.deepEqual(keyboardStyles[0], keyboardStyles[1], 'both horizontal handles have identical focus styling');
  await divider.press('Home');
  await divider.press('ArrowUp');
  assert.equal(await divider.getAttribute('aria-valuenow'), '30', 'split is bounded below');
  await divider.press('End');
  await divider.press('ArrowDown');
  assert.equal(await divider.getAttribute('aria-valuenow'), '70', 'split is bounded above');
  await divider.press('Enter');
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  const splitBox = await divider.boundingBox();
  await page.mouse.move(splitBox.x + splitBox.width / 2, splitBox.y + splitBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(splitBox.x + splitBox.width / 2 + 80, splitBox.y + splitBox.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.ok(Number(await divider.getAttribute('aria-valuenow')) > 50, 'vertical divider drags horizontally');
  await divider.dblclick();
});

test('Chromium native touch cancellation restores both resizers', async ({ page, context, browserName, app }) => {
  test.skip(browserName !== 'chromium', 'Native touch injection uses the Chromium DevTools protocol.');
  const touch = await context.newCDPSession(page);
  for (const label of ['Resize editor and preview', 'Resize workspace height']) {
    const handle = page.getByRole('separator', { name: label, exact: true });
    await handle.scrollIntoViewIfNeeded();
    const startValue = await handle.getAttribute('aria-valuenow');
    const touchBox = await handle.boundingBox();
    const touchPoint = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touchPoint, y: touchPoint.y + 20 }] });
    assert.notEqual(await handle.getAttribute('aria-valuenow'), startValue, 'touch drag updates either value');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await handle.getAttribute('aria-valuenow'), startValue, 'cancelled touch restores either value');

  }
  await touch.detach();
});

test("workspace height supports pointer, keyboard, reset and persistence", async ({ page, app }) => {
  const { editor, preview, ready } = app;
  const workspace = page.locator('#equation-workspace');
  const heightHandle = page.getByRole('separator', { name: 'Resize workspace height', exact: true });
  const divider = page.getByRole('separator', { name: 'Resize editor and preview' });
  const heightEditor = await editor.elementHandle();
  const heightSource = await editor.innerText();
  const originalHeight = (await workspace.boundingBox()).height;
  const grip = await heightHandle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 100, { steps: 5 });
  await page.mouse.up();
  assert.equal((await workspace.boundingBox()).height, originalHeight + 100, 'bottom handle grows the whole workspace');
  assert.equal(await divider.getAttribute('aria-valuenow'), '50', 'height resize preserves the split');
  assert.equal(await heightEditor.evaluate(node => node.isConnected), true, 'height resize keeps the editor mounted');
  assert.equal(await editor.innerText(), heightSource);

  // Cancelling a drag restores its starting height and releases capture.
  const cancelGrip = await heightHandle.boundingBox();
  await page.mouse.move(cancelGrip.x + cancelGrip.width / 2, cancelGrip.y + cancelGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelGrip.x + cancelGrip.width / 2, cancelGrip.y + cancelGrip.height / 2 - 40);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal((await workspace.boundingBox()).height, originalHeight + 100);

  await heightHandle.press('Home');
  await heightHandle.press('ArrowUp');
  assert.equal((await workspace.boundingBox()).height, 360, 'height is bounded below');
  await heightHandle.press('End');
  await heightHandle.press('ArrowDown');
  assert.equal((await workspace.boundingBox()).height, 1600, 'height is bounded above');
  await heightHandle.press('Enter');
  assert.equal((await workspace.boundingBox()).height, originalHeight, 'Enter resets workspace height');
  await heightHandle.press('Shift+ArrowDown');
  await page.reload();
  await ready();
  assert.equal((await workspace.boundingBox()).height, originalHeight + 100, 'workspace height survives reload');
});

test("fullscreen restores height and scroll; menus and Vim keep their Escape behavior", async ({ page, app }) => {
  const { editor, preview } = app;
  const workspace = page.locator('#equation-workspace');
  const heightHandle = page.getByRole('separator', { name: 'Resize workspace height', exact: true });
  const divider = page.getByRole('separator', { name: 'Resize editor and preview' });
  const originalHeight = (await workspace.boundingBox()).height;
  await heightHandle.press('Shift+ArrowDown');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  assert.equal(await heightHandle.count(), 0, 'fullscreen uses the viewport height');
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'fullscreen starts at the viewport top');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).count(), 1, 'first Escape closes the menu only');
  await page.locator('[role="menu"]:not([data-latex-toolbar-layer])').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).waitFor();
  assert.equal((await workspace.boundingBox()).height, originalHeight + 100, 'leaving fullscreen restores custom height');
  await heightHandle.dblclick();
  assert.equal((await workspace.boundingBox()).height, originalHeight, 'double-click resets workspace height');
  await page.setViewportSize({ width: 1280, height: 600 });
  // Let the browser finish scroll anchoring after changing viewport height.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => window.scrollTo(0, 40));
  const previousScroll = await page.evaluate(() => window.scrollY);
  assert.ok(previousScroll > 0, 'exercise a scrolled page');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await page.waitForFunction(() => window.scrollY === 0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Enable Vim Mode' }).click();
  await editor.focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).count(), 1, 'Vim Escape does not exit fullscreen');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Disable Vim Mode' }).click();
  await page.locator('[role="menu"]:not([data-latex-toolbar-layer])').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(y => window.scrollY === y, previousScroll);
  await page.setViewportSize({ width: 1280, height: 844 });
});
