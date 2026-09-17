#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
// Keep external counters/analytics out of deterministic local tests.
await page.route('https://**/*', route => route.abort());
await page.addInitScript(() => {
  localStorage.clear();
  // Simulate a slow worker response, including fonts loaded on demand. An
  // export must wait, even if the previous equation is still on screen.
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    set onmessage(handler) {
      super.onmessage = event => {
        if (event.data.id) setTimeout(() => handler(event), 400);
        else handler(event);
      };
    }
  };
  window.copiedItems = [];
  window.sharedFiles = [];
  Object.defineProperty(navigator, 'clipboard', { value: {
    write: async items => { window.copiedItems = items; },
    writeText: async text => { window.copiedText = text; },
  } });
  Object.defineProperty(navigator, 'canShare', { value: () => true });
  Object.defineProperty(navigator, 'share', { value: async ({ files }) => { window.sharedFiles = files; } });
});
const editor = page.getByRole('textbox', { name: 'LaTeX equation' });
const preview = page.getByRole('region', { name: 'Equation preview' });
async function ready() {
  await page.waitForFunction(() => document.querySelector('#preview-scroll')?.getAttribute('aria-busy') === 'false');
  await page.locator('#math-preview mjx-container > svg').waitFor();
}
async function setEquation(latex) {
  await editor.fill(latex);
  await ready();
}
async function openSaveMenu() {
  await page.getByRole('button', { name: 'More Save PNG options' }).click();
}
async function save(format, newLatex) {
  // Open first so changing the editor and selecting the export happen within
  // the debounce interval. Programmatic fill doesn't dismiss the menu.
  if (format !== 'PNG') await openSaveMenu();
  if (newLatex !== undefined) {
    await editor.fill(newLatex);
    assert.equal(await preview.getAttribute('aria-busy'), 'true', 'exercise a pending render');
  }
  const downloaded = page.waitForEvent('download');
  if (format === 'PNG') await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
  else await page.getByRole('menuitem', { name: `Save ${format}`, exact: true }).click();
  const download = await downloaded;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
function pdfContent(buffer) {
  // Ignore timestamps and document IDs, but compare page dimensions and paths.
  return buffer.toString('latin1').replace(/\/CreationDate \([^)]*\)/g, '')
    .replace(/\/ID \[.*?\]/gs, '');
}
async function menuAction(label) {
  await openSaveMenu();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

try {
  await page.goto(`${baseUrl}?latex=x`);
  await ready();
  for (const format of ['PNG', 'JPEG', 'SVG', 'PDF']) {
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
    console.log(`${format}: immediate export matches completed render`);
  }

  for (const action of ['Copy Image', 'Share Image', 'Copy MathML']) {
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
    console.log(`${action}: uses latest render`);
  }

  for (const invalid of [String.raw`\frac{1}{`, String.raw`\notACommand{x}`]) {
    await editor.fill(invalid);
    await page.locator('[data-mathjax-error]').waitFor();
    assert.equal(await editor.getAttribute('aria-invalid'), 'true');
    assert.equal(await editor.getAttribute('aria-describedby'), 'latex-feedback');
    assert.equal(await page.locator('#latex-feedback').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('#math-preview svg').count(), 0);
    const downloads = [];
    const onDownload = download => downloads.push(download);
    page.on('download', onDownload);
    await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
    await page.getByText(/Save PNG failed:/).last().waitFor();
    page.off('download', onDownload);
    assert.equal(downloads.length, 0, 'invalid input cannot download an old preview');
    await setEquation(String.raw`\underbar{x}`);
    assert.equal(await editor.getAttribute('aria-invalid'), 'false');
    assert.equal(await page.locator('#latex-feedback').textContent(), '');
  }
  await setEquation(String.raw`a &= b \\ c &= d`);
  assert.equal(await page.locator('#preview-scroll math mtable').count(), 1, 'accessible math includes automatic alignment');
  assert.equal(await page.locator('#math-preview').getAttribute('aria-hidden'), 'true');
  await editor.fill('');
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
  await page.getByText(/Enter a LaTeX equation before exporting/).waitFor();
  console.log('Accessibility: labelled editor, MathML, announced errors, recovery and empty input');

  // Keyboard operation and focus restoration for both menus.
  for (const label of ['Insert math symbol', 'More Save PNG options']) {
    const trigger = page.getByRole('button', { name: label, exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.locator('[role="menu"][data-state="open"]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(name => document.activeElement?.getAttribute('aria-label') === name, label);
  }
  await editor.focus();
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'LaTeX equation');
  console.log('Keyboard: menus open, Escape restores focus, editor does not trap Tab');

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
  console.log('Drag: stale images blocked; completed images carry matching LaTeX');

  const formula = String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`;
  await setEquation(formula);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const scale of ['1', '1.5', '5']) {
      await page.getByRole('slider', { name: 'Zoom level' }).fill(scale);
      // Wait for the zoom layout effect, then measure the actual scroll area.
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const bounds = await page.evaluate(() => {
        const box = id => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
        };
        const scroll = document.getElementById('preview-scroll');
        return { toolbar: box('preview-toolbar'), scroll: box('preview-scroll'), actions: box('preview-actions'),
          pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
          canScroll: scroll.scrollWidth > scroll.clientWidth };
      });
      assert.ok(bounds.toolbar.bottom <= bounds.scroll.top + 1, `toolbar clear at ${width}/${scale}`);
      assert.ok(bounds.scroll.bottom <= bounds.actions.top + 1, `save clear at ${width}/${scale}`);
      assert.ok(bounds.scroll.height > 40, 'preview retains usable space');
      assert.ok(bounds.pageWidth <= bounds.viewportWidth + 1, 'wide equations scroll inside the preview');
      if (width <= 390 && scale === '5') assert.ok(bounds.canScroll, 'oversized equation remains scrollable');
    }
  }
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Enter Fullscreen' }).click();
  assert.equal(await page.locator('[data-pane-resizer]').getAttribute('data-direction'), 'horizontal');
  const previewBox = await preview.boundingBox();
  assert.ok(previewBox.height > 100, 'side by side fullscreen preview remains usable');
  console.log('Layout: 320–1280px, 1–5x zoom, side by side and fullscreen');
  assert.deepEqual(pageErrors, [], 'no uncaught errors');
  console.log('UI regression tests passed.');
} catch (error) {
  await page.screenshot({ path: 'snapshots/ui-failure.png.actual', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
