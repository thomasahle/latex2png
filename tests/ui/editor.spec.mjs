import assert from 'node:assert/strict';
import { test, formula } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

for (const invalid of [String.raw`\frac{1}{`, String.raw`\notACommand{x}`]) {
  test(`invalid input ${invalid} blocks export and recovers`, async ({ page, app }) => {
    const { editor, preview, setEquation } = app;
    await editor.fill(invalid);
    await page.locator('[data-mathjax-error]').waitFor();
    assert.equal(await editor.getAttribute('aria-invalid'), 'true');
    assert.equal(await editor.getAttribute('aria-describedby'), 'latex-feedback');
    assert.equal(await page.locator('#latex-feedback').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('#math-preview svg').count(), 0);
    const downloads = [];
    const onDownload = download => downloads.push(download);
    page.on('download', onDownload);
    await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
    await page.getByText(/Download failed:/).last().waitFor();
    page.off('download', onDownload);
    assert.equal(downloads.length, 0, 'invalid input cannot download an old preview');
    await setEquation(String.raw`\underbar{x}`);
    assert.equal(await editor.getAttribute('aria-invalid'), 'false');
    assert.equal(await page.locator('#latex-feedback').textContent(), '');
  });
}

test("accessible MathML and empty input", async ({ page, app }) => {
  const { editor, preview, setEquation } = app;
  await setEquation(String.raw`a &= b \\ c &= d`);
  assert.equal(await page.locator('#preview-scroll math mtable').count(), 1, 'accessible math includes automatic alignment');
  assert.equal(await page.locator('#math-preview').getAttribute('aria-hidden'), 'true');
  await editor.fill('');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  await page.getByText(/Enter a LaTeX equation before exporting/).waitFor();
});

for (const label of ['Insert math symbol', 'Settings', 'Export format', 'Export background']) {
  test(`keyboard opens ${label} and Escape restores focus`, async ({ page, app }) => {
    const trigger = page.getByRole('button', { name: label, exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.locator('[role="menu"][data-state="open"]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(name => document.activeElement?.getAttribute('aria-label') === name, label);
  });
}

test("editor does not trap Tab", async ({ page, app }) => {
  const { editor } = app;
  await editor.focus();
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'LaTeX equation');
});

test("pending drag cannot use an obsolete image", async ({ page, app }) => {
  const { editor, preview, ready, setEquation } = app;
  // A drag cannot wait asynchronously: cancel it until a current image exists.
  await setEquation('x');
  await editor.fill(String.raw`\frac{24680}{3}`);
  assert.equal(await page.evaluate(() => document.querySelector('#math-preview').dispatchEvent(
    new DragEvent('dragstart', { cancelable: true, dataTransfer: new DataTransfer() }),
  )), false, 'pending renders cannot drag an old image');
  await ready();
  await page.waitForFunction(() => {
    const element = document.querySelector('#math-preview');
    const data = new DataTransfer();
    const allowed = element.dispatchEvent(new DragEvent('dragstart', { cancelable: true, dataTransfer: data }));
    element.dispatchEvent(new DragEvent('dragend'));
    return allowed && data.getData('text/plain') === String.raw`\frac{24680}{3}` && data.getData('text/uri-list').startsWith('data:image/png');
  });
});

test("formula drags reject the page background and still reach valid drop targets", async ({ page, app, browserName }) => {
  await app.setEquation(formula);
  await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'drag-test-target';
    target.style = 'position:fixed;top:70px;left:0;width:100px;height:100px;z-index:10000';
    document.body.append(target);
    document.addEventListener('dragstart', event => {
      window.dragResult = { started: event.isTrusted, drops: 0, targetAccepted: false };
    }, { capture: true });
    document.addEventListener('dragover', event => {
      if (event.target.id === 'drag-test-target') {
        window.dragResult.overTarget = true;
        window.dragResult.targetAccepted = event.defaultPrevented;
      }
    });
    document.addEventListener('drop', () => window.dragResult.drops++, { capture: true });
    document.addEventListener('dragend', event => {
      window.dragResult.ended = event.isTrusted;
      window.dragResult.effect = event.dataTransfer.dropEffect;
    });
  });

  for (const accepted of [false, true]) {
    if (accepted) await page.evaluate(() => {
      const target = document.getElementById('drag-test-target');
      target.ondragover = event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; };
      target.ondrop = event => {
        event.preventDefault();
        window.dragResult.latex = event.dataTransfer.getData('text/plain');
      };
    });
    await page.evaluate(() => { window.dragResult = null; });
    const source = await page.locator('#math-preview').boundingBox();
    const x = source.x + source.width / 2;
    const y = source.y + source.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 12, y, { steps: 5 });
    await page.mouse.move(50, 120, { steps: 5 });
    // WebKit needs a movement inside the target after dragenter to send dragover.
    await page.mouse.move(51, 121);
    await page.mouse.up();
    await page.waitForFunction(() => window.dragResult?.ended);
    const result = await page.evaluate(() => window.dragResult);
    assert.equal(result.started, true, 'exercise the native browser drag');
    assert.equal(result.overTarget, true, 'the pointer reaches the drop target');
    assert.equal(result.targetAccepted, accepted, 'the page must not override a target’s dragover decision');
    assert.equal(result.drops, accepted ? 1 : 0, 'only a real drop target accepts the formula');
    // WebKit reports a stale operation at dragend even when no drop occurred.
    // Its dragover/drop assertions above still verify acceptance and rejection.
    if (browserName !== 'webkit') assert.equal(result.effect, accepted ? 'copy' : 'none', 'rejected drops retain native return feedback');
    if (accepted) assert.equal(result.latex, formula);
    assert.equal(await page.locator('#math-preview').evaluate(el => el.style.cursor), '');
    assert.equal(await page.locator('#math-preview').evaluate(el => el.style.backgroundColor), '');
  }
});

for (const background of ['Transparent', 'Solid', 'Custom']) {
  test(`drag ghost uses the displayed formula size and ${background} background`, async ({ page, app }) => {
    await app.setEquation(formula);
    await chooseExportOption(page, 'Export background', background);
    if (background === 'Custom') await page.getByLabel('Custom background color', { exact: true }).fill('#2060c0');
    await page.getByRole('slider', { name: 'Zoom level' }).fill('3');
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
    const result = await page.evaluate(() => {
      const element = document.querySelector('#math-preview');
      const nativeImage = document.querySelector('#formula-drag-image');
      const rect = element.getBoundingClientRect();
      const data = new DataTransfer();
      let ghost;
      data.setDragImage = (image, x, y) => {
        const bounds = image.getBoundingClientRect();
        ghost = { width: bounds.width, height: bounds.height, x, y,
          background: getComputedStyle(image).backgroundColor,
          isolation: getComputedStyle(image).isolation };
      };
      nativeImage.dispatchEvent(new DragEvent('dragstart', { cancelable: true, dataTransfer: data,
        clientX: rect.left + 20, clientY: rect.top + 10 }));
      nativeImage.dispatchEvent(new DragEvent('dragend'));
      return { ghost, displayed: { width: rect.width, height: rect.height },
        png: data.getData('text/uri-list'), source: data.getData('text/plain'),
        backgroundAfterDrag: element.style.backgroundColor };
    });
    assert.equal(result.ghost.width, result.displayed.width);
    assert.equal(result.ghost.height, result.displayed.height);
    // DragEvent coordinates round to CSS pixels in some browsers.
    assert.ok(Math.abs(result.ghost.x - 20) <= 1);
    assert.ok(Math.abs(result.ghost.y - 10) <= 1);
    assert.equal(result.ghost.background, background === 'Transparent' ? 'rgba(0, 0, 0, 0)'
      : background === 'Custom' ? 'rgb(32, 96, 192)' : 'rgb(250, 250, 250)');
    assert.equal(result.ghost.isolation, 'isolate');
    assert.match(result.png, /^data:image\/png/);
    assert.equal(result.source, formula);
    assert.equal(result.backgroundAfterDrag, '');
  });
}
