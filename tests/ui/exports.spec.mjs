import assert from 'node:assert/strict';
import { test, formula, pdfContent } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

for (const format of ['PNG', 'JPEG', 'SVG', 'PDF']) {
  test(`pending ${format} export uses the latest equation`, async ({ page, app }) => {
    const { setEquation, save } = app;
    await setEquation('x');
    const old = await save(format);
    const latex = String.raw`\mathcal{F}(x) = \frac{123456789}{\sqrt{1+x^2}}`;
    const immediate = await save(format, latex);
    const settled = await save(format);
    assert.ok(immediate.length > 100, `${format} is not empty`);
    assert.notDeepEqual(immediate, old, `${format} must not export the old equation`);
    if (format === 'PDF') assert.equal(pdfContent(immediate), pdfContent(settled));
    else assert.deepEqual(immediate, settled, `${format} rapid export matches the completed render`);
    const savedLatex = await page.evaluate(() => JSON.parse(localStorage.equationHistory)[0].latex);
    assert.equal(savedLatex, latex, 'history records the exported equation');
  });
}

for (const action of ['Copy Image', 'Share Image', 'Copy MathML']) {
  test(`pending ${action} uses the latest equation`, async ({ page, app }) => {
    const { editor, setEquation, openSaveMenu, save } = app;
    await chooseExportOption(page, 'Export format', 'PNG');
    await setEquation('x');
    await openSaveMenu();
    const latex = String.raw`\frac{987654321}{2}`;
    await editor.fill(latex);
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    if (action === 'Copy MathML') {
      await page.waitForFunction(() => window.copiedText?.includes('987654321'));
      assert.match(await page.evaluate(() => window.copiedText), /<mfrac\b/);
    } else {
      await page.waitForFunction(kind => kind === 'Copy Image' ? window.copiedItems.length : window.sharedFiles.length, action);
      const bytes = await page.evaluate(async kind => {
        const blob = kind === 'Copy Image' ? await window.copiedItems[0].getType('image/png') : window.sharedFiles[0];
        return [...new Uint8Array(await blob.arrayBuffer())];
      }, action);
      assert.deepEqual(Buffer.from(bytes), await save('PNG'), `${action} uses latest render`);
    }
  });
}

test("export bar shares zoom and background; JPEG explains disabled transparency", async ({ page, app }) => {
  const { setEquation, save } = app;
  await setEquation(formula);
  await page.getByRole('slider', { name: 'Zoom level' }).fill('1');
  const small = await save('PNG');
  await page.getByRole('slider', { name: 'Zoom level' }).fill('3');
  const large = await save('PNG');
  assert.ok(Math.abs(large.readUInt32BE(16) - small.readUInt32BE(16) * 3) <= 1);
  assert.ok(Math.abs(large.readUInt32BE(20) - small.readUInt32BE(20) * 3) <= 1);
  await chooseExportOption(page, 'Export background', 'Solid');
  const solid = await save('PNG');
  const alpha = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    image.close();
    return ctx.getImageData(0, 0, 1, 1).data[3];
  }, [...solid]);
  assert.equal(alpha, 255, 'solid background is opaque');
  await page.evaluate(() => { window.copiedItems = []; });
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await page.waitForFunction(() => window.copiedItems.length);
  const copied = await page.evaluate(async () => [...new Uint8Array(await (await window.copiedItems[0].getType('image/png')).arrayBuffer())]);
  assert.deepEqual(Buffer.from(copied), solid, 'export bar Copy uses the selected size and background');
  await chooseExportOption(page, 'Export format', 'JPEG');
  await page.getByRole('button', { name: 'Export background', exact: true }).click();
  assert.equal(await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).getAttribute('aria-disabled'), 'true', 'JPEG cannot select transparency');
  await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).hover();
  await page.getByRole('tooltip', { name: "JPEG doesn't support transparency", exact: true }).waitFor();
  const explanationBox = await page.getByRole('tooltip').boundingBox();
  const viewportSize = page.viewportSize();
  assert.ok(explanationBox.x >= 0 && explanationBox.y >= 0 && explanationBox.x + explanationBox.width <= viewportSize.width && explanationBox.y + explanationBox.height <= viewportSize.height, 'disabled explanation is positioned inside the viewport');
  await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).click({ force: true });
  assert.equal(await page.getByRole('menuitemradio', { name: 'Solid', exact: true }).getAttribute('aria-checked'), 'true', 'hoverable disabled item stays unselectable');
  await page.getByRole('menuitemradio', { name: 'Solid', exact: true }).hover();
  await page.getByRole('tooltip').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).waitFor({ state: 'detached' });
  await chooseExportOption(page, 'Export format', 'PNG');
  await chooseExportOption(page, 'Export background', 'Transparent');
});

test("custom color appears in every export and survives format changes", async ({ page, app }) => {
  const { preview, setEquation, save } = app;
  await setEquation(formula);
  await page.getByRole('slider', { name: 'Zoom level' }).fill('3');
  // Use a recognizable RGB value to check every export path, not just the UI.
  await chooseExportOption(page, 'Export background', 'Custom');
  await page.getByLabel('Custom background color', { exact: true }).fill('#2060c0');
  assert.match(await page.getByRole('button', { name: 'Export background', exact: true }).textContent(), /Custom/);
  assert.equal(await preview.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(32, 96, 192)', 'custom background appears in the preview');
  const customPNG = await save('PNG');
  const customJPEG = await save('JPEG');
  for (const [format, bytes] of [['PNG', customPNG], ['JPEG', customJPEG]]) {
    const pixel = await page.evaluate(async ({ bytes, format }) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: format === 'PNG' ? 'image/png' : 'image/jpeg' }));
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
      return [...ctx.getImageData(0, 0, 1, 1).data];
    }, { bytes: [...bytes], format });
    [32, 96, 192, 255].forEach((value, i) => assert.ok(Math.abs(pixel[i] - value) <= 2, `${format}: custom background pixel`));
  }
  const customSVG = (await save('SVG')).toString();
  assert.match(customSVG, /<rect[^>]+fill="#2060c0"/, 'SVG includes the custom background');
  const customPDF = (await save('PDF')).toString('latin1');
  const pdfColors = [...customPDF.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)];
  assert.ok(pdfColors.some(match => [32, 96, 192].every((v, i) => Math.abs(Number(match[i + 1]) - v / 255) < .01)), 'PDF paints the custom background');
  await page.evaluate(() => { window.copiedItems = []; });
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await page.waitForFunction(() => window.copiedItems.length);
  const customCopied = await page.evaluate(async () => [...new Uint8Array(await (await window.copiedItems[0].getType('image/png')).arrayBuffer())]);
  assert.deepEqual(Buffer.from(customCopied), customPNG, 'Copy preserves the custom background');
  await page.getByRole('button', { name: 'Export background', exact: true }).click();
  assert.equal(await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).getAttribute('aria-disabled'), 'true', 'PDF cannot select transparency');
  await page.getByRole('menuitemradio', { name: 'Transparent', exact: true }).hover();
  await page.getByRole('tooltip', { name: 'PDF exports use an opaque page background', exact: true }).waitFor();
  await page.getByRole('menuitemradio', { name: 'Custom', exact: true }).hover();
  await page.getByRole('tooltip').waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('menuitemradio', { name: 'Custom', exact: true }).getAttribute('aria-checked'), 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('menuitemradio', { name: 'Custom', exact: true }).waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 320, height: 844 });
  const customFits = await page.locator('#preview-actions').evaluate(bar => {
    const bounds = bar.getBoundingClientRect();
    return [...bar.querySelectorAll('button')].every(control => control.getBoundingClientRect().right <= bounds.right - 9);
  });
  assert.ok(customFits, 'custom color controls fit at 320px');
  await page.getByRole('button', { name: 'Export background', exact: true }).click();
  const mobileMenu = await page.locator('[role="menu"][data-state="open"]').boundingBox();
  assert.ok(mobileMenu.x >= 0 && mobileMenu.x + mobileMenu.width <= 320, 'mobile background menu stays in the viewport');
  await page.keyboard.press('Escape');
  await page.getByRole('menuitemradio', { name: 'Custom', exact: true }).waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1280, height: 844 });
  await chooseExportOption(page, 'Export format', 'PNG');
  await chooseExportOption(page, 'Export background', 'Solid');
  assert.equal(await preview.evaluate(el => el.style.backgroundColor), '', 'solid mode clears the custom preview color');
  await chooseExportOption(page, 'Export background', 'Transparent');
  assert.equal(await preview.evaluate(el => el.style.backgroundColor), '', 'transparent mode uses the normal preview background');
  await chooseExportOption(page, 'Export format', 'JPEG');
  assert.match(await page.getByRole('button', { name: 'Export background', exact: true }).textContent(), /Solid/);
  await chooseExportOption(page, 'Export format', 'PNG');
  assert.match(await page.getByRole('button', { name: 'Export background', exact: true }).textContent(), /Transparent/, 'switching to an opaque format preserves the transparency preference');
  assert.equal(await page.getByLabel('Custom background color', { exact: true }).inputValue(), '#2060c0', 'switching backgrounds preserves the last custom color');
});
