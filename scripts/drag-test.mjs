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
          latex: data.getData('text/plain'),
          cursor: source.style.cursor,
        };
        return true;
      });
      const result = await page.evaluate(() => window.dragResult);
      const label = `DPR ${deviceScaleFactor}, zoom ${scale}`;
      assert.ok(Math.abs(result.feedback.width - result.source.width) < 1, `${label}: drag preview width matches the displayed formula`);
      assert.ok(Math.abs(result.feedback.height - result.source.height) < 1, `${label}: drag preview height matches the displayed formula`);
      assert.ok(Math.abs(result.feedback.x - result.offset.x) < 1, `${label}: horizontal grab point is preserved`);
      assert.ok(Math.abs(result.feedback.y - result.offset.y) < 1, `${label}: vertical grab point is preserved`);
      assert.equal(result.latex, formula);
      assert.equal(result.cursor, '', `${label}: cursor resets after dragging`);

      // The cursor image must not reduce the resolution of the actual payload.
      const png = Buffer.from(result.png.split(',')[1], 'base64');
      assert.ok(png.readUInt32BE(16) > result.source.width * deviceScaleFactor, `${label}: PNG retains high-resolution pixels and padding`);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
      const download = await downloaded;
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.deepEqual(png, Buffer.concat(chunks), `${label}: dropped PNG matches Download PNG`);
    }
    console.log(`Drag preview: DPR ${deviceScaleFactor}, zoom 1–5×, matching size and grab point; full-resolution PNG preserved`);
    await context.close();
  }
} finally {
  await browser.close();
}
