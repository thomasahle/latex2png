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
  if (!sessionStorage.getItem('qa-initialized')) {
    localStorage.clear();
    sessionStorage.setItem('qa-initialized', 'true');
  }
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
  await page.locator('#math-preview').click({ button: 'right' });
}
async function save(format, newLatex) {
  await page.getByLabel('Export format', { exact: true }).selectOption(format);
  if (newLatex !== undefined) {
    await editor.fill(newLatex);
    assert.equal(await preview.getAttribute('aria-busy'), 'true', 'exercise a pending render');
  }
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${format}`, exact: true }).click();
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
    await page.getByLabel('Export format', { exact: true }).selectOption('PNG');
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
    await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
    await page.getByText(/Download failed:/).last().waitFor();
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
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  await page.getByText(/Enter a LaTeX equation before exporting/).waitFor();
  console.log('Accessibility: labelled editor, MathML, announced errors, recovery and empty input');

  // Keyboard operation and focus restoration for both menus.
  for (const label of ['Insert math symbol', 'Settings']) {
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
  for (const width of [320, 390, 480, 640, 768, 1280]) {
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
        const math = document.querySelector('#math-preview svg').getBoundingClientRect();
        const controlsOverlap = [...document.querySelectorAll('#preview-toolbar button, #preview-toolbar input')].some(control => {
          const r = control.getBoundingClientRect();
          return r.left < math.right && r.right > math.left && r.top < math.bottom && r.bottom > math.top;
        });
        const pane = box('preview-pane');
        return { toolbar: box('preview-toolbar'), scroll: box('preview-scroll'), actions: box('preview-actions'),
          pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
          controlsOverlap, centered: Math.abs((math.top + math.bottom - pane.top - pane.bottom) / 2) < 1,
          fitsVertically: scroll.scrollHeight <= scroll.clientHeight,
          topReachable: math.top >= scroll.getBoundingClientRect().top,
          canScroll: scroll.scrollWidth > scroll.clientWidth };
      });
      assert.ok(!bounds.controlsOverlap, `toolbar clear at ${width}/${scale}`);
      if (bounds.fitsVertically) assert.ok(bounds.centered, `equation vertically centered at ${width}/${scale}`);
      else assert.ok(bounds.topReachable, `tall equation starts inside the scroll region at ${width}/${scale}`);
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
  }
  await page.getByRole('button', { name: 'Toggle layout orientation' }).click();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  assert.equal(await page.locator('[data-pane-resizer]').getAttribute('data-direction'), 'horizontal');
  const previewBox = await preview.boundingBox();
  assert.ok(previewBox.height > 100, 'side by side fullscreen preview remains usable');
  console.log('Layout: 320–1280px, 1–5x zoom, side by side and fullscreen');

  // Switching views must not alter the equation, editor instance, or export size.
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
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

  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'fullscreen starts at the viewport top');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).count(), 1, 'first Escape closes the menu only');
  await page.locator('[role="menu"]:not([data-latex-toolbar-layer])').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).waitFor();
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
  console.log('Workspace: separate remembered splits, reset, stable exports, fullscreen Escape');

  await setEquation(formula);
  await page.getByRole('slider', { name: 'Zoom level' }).fill('1');
  const small = await save('PNG');
  await page.getByRole('slider', { name: 'Zoom level' }).fill('3');
  const large = await save('PNG');
  assert.ok(Math.abs(large.readUInt32BE(16) - small.readUInt32BE(16) * 3) <= 1);
  assert.ok(Math.abs(large.readUInt32BE(20) - small.readUInt32BE(20) * 3) <= 1);
  await page.getByLabel('Export background', { exact: true }).selectOption('solid');
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
  await page.getByLabel('Export format', { exact: true }).selectOption('JPEG');
  assert.equal(await page.getByLabel('Export background', { exact: true }).isDisabled(), true, 'JPEG cannot select transparency');
  await page.getByLabel('Export format', { exact: true }).selectOption('PNG');
  await page.getByLabel('Export background', { exact: true }).selectOption('transparent');
  console.log('Export bar: shared zoom, solid background, format constraints');

  assert.deepEqual(pageErrors, [], 'no uncaught errors');
  console.log('UI regression tests passed.');
} catch (error) {
  await page.screenshot({ path: 'snapshots/ui-failure.png.actual', type: 'png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
