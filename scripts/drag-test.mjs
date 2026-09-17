#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
const browser = await chromium.launch({ headless: true });
const formula = String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`;

try {
  for (const deviceScaleFactor of [1, 1.5, 2, 3]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 }, deviceScaleFactor, acceptDownloads: true,
    });
    const page = await context.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => {
      // Observe the image passed to the browser, rather than checking the
      // implementation's choice of element. An <img> uses its intrinsic size.
      const original = DataTransfer.prototype.setDragImage;
      DataTransfer.prototype.setDragImage = function (element, x, y) {
        const rect = element.getBoundingClientRect();
        window.dragFeedback = {
          width: element instanceof HTMLImageElement ? element.naturalWidth : rect.width,
          height: element instanceof HTMLImageElement ? element.naturalHeight : rect.height,
          x, y,
        };
        return original.call(this, element, x, y);
      };
    });
    await page.goto(`${baseUrl}?latex=${encodeURIComponent(formula)}`);
    await page.locator('#math-preview svg').waitFor();

    for (const scale of ['1', '1.5', '3', '5']) {
      await page.getByRole('slider', { name: 'Zoom level' }).fill(scale);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      await page.waitForFunction(() => {
        const source = document.querySelector('#math-preview');
        const rect = source.getBoundingClientRect();
        const data = new DataTransfer();
        const event = new DragEvent('dragstart', {
          cancelable: true, dataTransfer: data,
          clientX: rect.left + rect.width * .4,
          clientY: rect.top + rect.height * .6,
        });
        window.dragFeedback = null;
        const allowed = source.dispatchEvent(event);
        source.dispatchEvent(new DragEvent('dragend'));
        if (!allowed || !window.dragFeedback) return false;
        window.dragResult = {
          feedback: window.dragFeedback,
          source: { width: rect.width, height: rect.height },
          offset: { x: event.clientX - rect.left, y: event.clientY - rect.top },
          png: data.getData('text/uri-list'),
          files: [...data.files],
          types: [...data.types],
          latex: data.getData('text/plain'),
          cursor: source.style.cursor,
        };
        return true;
      });
      const result = await page.evaluate(async () => ({
        ...window.dragResult,
        files: await Promise.all(window.dragResult.files.map(async file => ({
          name: file.name, type: file.type, bytes: [...new Uint8Array(await file.arrayBuffer())],
        }))),
      }));
      const label = `DPR ${deviceScaleFactor}, zoom ${scale}`;
      assert.ok(Math.abs(result.feedback.width - result.source.width) < 1, `${label}: drag preview width matches the displayed formula`);
      assert.ok(Math.abs(result.feedback.height - result.source.height) < 1, `${label}: drag preview height matches the displayed formula`);
      assert.ok(Math.abs(result.feedback.x - result.offset.x) < 1, `${label}: horizontal grab point is preserved`);
      assert.ok(Math.abs(result.feedback.y - result.offset.y) < 1, `${label}: vertical grab point is preserved`);
      assert.equal(result.latex, formula);
      assert.equal(result.cursor, '', `${label}: cursor resets after dragging`);

      // The cursor image must not reduce the resolution of the actual payload.
      const png = Buffer.from(result.png.split(',')[1], 'base64');
      assert.ok(result.types.includes('Files'), `${label}: advertises files to upload targets`);
      assert.equal(result.files.length, 1, `${label}: includes one PNG file`);
      assert.equal(result.files[0].name, 'latex-equation.png');
      assert.equal(result.files[0].type, 'image/png');
      assert.deepEqual(Buffer.from(result.files[0].bytes), png, `${label}: file and image payloads match`);
      assert.ok(png.readUInt32BE(16) > result.source.width * deviceScaleFactor, `${label}: PNG retains high-resolution pixels and padding`);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
      const download = await downloaded;
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.deepEqual(png, Buffer.concat(chunks), `${label}: dropped PNG matches Download PNG`);
    }
    console.log(`Drag preview: DPR ${deviceScaleFactor}, zoom 1–5×, matching size and grab point; full-resolution PNG preserved`);
    if (deviceScaleFactor === 2) {
      await page.getByRole('slider', { name: 'Zoom level' }).fill('1.5');
      await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
      await page.evaluate(() => {
        // Capture before the app's handler. Chromium only transports its own
        // native image file; adding a File in dragstart is insufficient.
        document.addEventListener('dragstart', event => {
          const files = [...event.dataTransfer.files];
          window.nativeDrag = Promise.all(files.map(async file => ({
            type: file.type, bytes: [...new Uint8Array(await file.arrayBuffer())],
          }))).then(files => ({ trusted: event.isTrusted, files }));
        }, { capture: true, once: true });
        const target = document.createElement('div');
        target.id = 'drag-test-target';
        target.style = 'position:fixed;top:70px;right:0;width:100px;height:100px;z-index:10000';
        target.ondragover = event => event.preventDefault();
        target.ondrop = event => event.preventDefault();
        document.body.append(target);
      });
      // Start from the visible formula's position, so the test catches a
      // missing/misaligned native image source without relying on its ID.
      const source = await page.locator('#math-preview').boundingBox();
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 5 });
      await page.mouse.move(1230, 120, { steps: 5 });
      await page.mouse.up();
      const native = await page.evaluate(() => window.nativeDrag);
      assert.equal(native.trusted, true, 'pointer drag starts a native browser operation');
      assert.equal(native.files.length, 1, 'browser supplies one native file before the app adds formats');
      assert.equal(native.files[0].type, 'image/png');
      const downloadEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
      const download = await downloadEvent;
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.deepEqual(Buffer.from(native.files[0].bytes), Buffer.concat(chunks), 'native image file matches the downloaded PNG');
      console.log('Drag file: trusted pointer drag starts with native, full-resolution PNG bytes');

      const cdp = await context.newCDPSession(page);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
        await page.reload();
        await page.locator('#math-preview svg').waitFor();
        for (const background of ['solid', 'transparent']) {
          await page.getByRole('combobox', { name: 'Export background' }).selectOption(background);
          await page.waitForFunction(() => {
            const source = document.querySelector('#math-preview');
            const data = new DataTransfer();
            const allowed = source.dispatchEvent(new DragEvent('dragstart', { cancelable: true, dataTransfer: data }));
            if (!allowed) return false;
            window.backgroundDragPng = data.getData('text/uri-list');
            return true;
          });
          // Chromium captures from the nearest stacking context. Ask its layout
          // engine directly: the formula must be a separate context so opaque
          // panels behind it cannot be painted into the cursor preview.
          const snapshot = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: ['background-color'] });
          const doc = snapshot.documents[0];
          const node = doc.nodes.attributes.findIndex(attrs => attrs?.some((value, i) =>
            snapshot.strings[value] === 'id' && snapshot.strings[attrs[i + 1]] === 'math-preview'));
          const layoutIndex = doc.layout.nodeIndex.indexOf(node);
          assert.ok(doc.layout.stackingContexts.index.includes(layoutIndex), 'cursor image is painted independently of the panel behind it');
          const color = snapshot.strings[doc.layout.styles[layoutIndex][0]];
          assert.equal(color === 'rgba(0, 0, 0, 0)', background === 'transparent', `${theme}: cursor background follows the dropdown`);
          const alpha = await page.evaluate(async () => {
            document.querySelector('#math-preview').dispatchEvent(new DragEvent('dragend'));
            const image = new Image(); image.src = window.backgroundDragPng;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return ctx.getImageData(0, 0, 1, 1).data[3];
          });
          assert.equal(alpha, background === 'transparent' ? 0 : 255, `${theme}: PNG background follows the dropdown`);
          assert.equal(await page.locator('#math-preview').evaluate(el => el.style.backgroundColor), '', 'dragend restores the displayed formula background');
        }
      }
      await cdp.detach();
      console.log('Drag background: transparent/solid cursor previews and PNGs in light/dark themes');
    }
    await context.close();
  }
} finally {
  await browser.close();
}
