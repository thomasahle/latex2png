import { writeFile } from 'node:fs/promises';
import { test, expect, baseUrl } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

async function loadEquation(page, app, latex) {
  // Load exact source through the public link format. These tests compare
  // exports independently of mobile contenteditable selection/input timing.
  await page.goto(`${baseUrl}?latex=${encodeURIComponent(latex)}`);
  await app.ready();
  await expect(app.editor).toHaveText(latex);
}

async function inspectImages(page, png, svg) {
  return page.evaluate(async ({ png, svg }) => {
    const results = [];
    for (const [type, bytes] of [['image/png', png], ['image/svg+xml', svg]]) {
      const blob = new Blob([new Uint8Array(bytes)], { type });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        if (type === 'image/svg+xml') {
          const doc = new DOMParser().parseFromString(await blob.text(), type);
          canvas.width = Math.round(Number(doc.documentElement.getAttribute('width')));
          canvas.height = Math.round(Number(doc.documentElement.getAttribute('height')));
        } else {
          const dpr = Math.max(1, Math.ceil(devicePixelRatio));
          canvas.width = Math.round(image.naturalWidth / dpr);
          canvas.height = Math.round(image.naturalHeight / dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            if (data[offset + 3] > 128 && Math.min(...data.slice(offset, offset + 3)) < 128) {
              left = Math.min(left, x); right = Math.max(right, x);
              top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
          }
        }
        // Stay one pixel inside the border: SVG dimensions can be fractional,
        // so rasterizing to whole pixels may antialias the outermost edge.
        const corners = [[1, 1], [canvas.width - 2, 1], [1, canvas.height - 2], [canvas.width - 2, canvas.height - 2]];
        results.push({ width: canvas.width, height: canvas.height,
          ink: right < 0 ? null : { left, right, top, bottom },
          corners: corners.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]),
        });
      } finally { URL.revokeObjectURL(url); }
    }
    return results;
  }, { png: [...png], svg: [...svg] });
}

test('SVG preserves intentional spacing, glyph size, and background across zoom levels', async ({ page, app }, testInfo) => {
  await chooseExportOption(page, 'Export background', 'Custom');
  await page.getByLabel('Custom background color', { exact: true }).fill('#ffffff');
  const examples = [
    [String.raw`x\hspace{4em}`, 1],
    [String.raw`\hspace{4em}x`, 3],
    [String.raw`x\phantom{MMMM}`, 1.5],
    [String.raw`\phantom{MMMM}x`, 1.5],
    [String.raw`x\vphantom{\dfrac{1}{\frac{a}{b}}}`, 2],
    [String.raw`\frac{x+1}{2}`, 1.5],
  ];
  for (const [latex, zoom] of examples) {
    await loadEquation(page, app, latex);
    await page.getByRole('slider', { name: 'Zoom level' }).fill(String(zoom));
    const png = await app.save('PNG');
    const svg = await app.save('SVG');
    const [raster, vector] = await inspectImages(page, png, svg);
    expect(Math.abs(vector.width - raster.width), latex).toBeLessThanOrEqual(1);
    expect(Math.abs(vector.height - raster.height), latex).toBeLessThanOrEqual(1);
    expect(vector.ink, latex).not.toBeNull();
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      expect(Math.abs(vector.ink[edge] - raster.ink[edge]), `${latex}: ${edge}`).toBeLessThanOrEqual(2);
    }
    for (const corner of vector.corners) expect(corner, latex).toEqual([255, 255, 255, 255]);
  }
  await page.screenshot({ path: testInfo.outputPath('vector-export-controls.png'), animations: 'disabled' });
});

test('invisible spacing exports valid blank images with the complete background', async ({ page, app }, testInfo) => {
  await chooseExportOption(page, 'Export background', 'Custom');
  await page.getByLabel('Custom background color', { exact: true }).fill('#ffffff');
  for (const latex of [String.raw`\phantom{MMMM}`, String.raw`\hspace{4em}`, String.raw`\vphantom{\frac{a}{b}}`]) {
    await loadEquation(page, app, latex);
    const png = await app.save('PNG');
    const svg = await app.save('SVG');
    expect(svg.toString()).not.toMatch(/NaN|Infinity/);
    const [raster, vector] = await inspectImages(page, png, svg);
    expect(vector.ink, latex).toBeNull();
    expect(Math.abs(vector.width - raster.width), latex).toBeLessThanOrEqual(1);
    expect(Math.abs(vector.height - raster.height), latex).toBeLessThanOrEqual(1);
    for (const corner of vector.corners) expect(corner, latex).toEqual([255, 255, 255, 255]);
  }
  // Retain real downloads for independent PDF rendering and visual comparison.
  await loadEquation(page, app, String.raw`x\phantom{MMMM}`);
  await writeFile(testInfo.outputPath('spaced.png'), await app.save('PNG'));
  await writeFile(testInfo.outputPath('spaced.svg'), await app.save('SVG'));
  await writeFile(testInfo.outputPath('spaced.pdf'), await app.save('PDF'));
});
