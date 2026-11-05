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
        const [leftInset, rightInset] = canvas.width > 2 ? [1, canvas.width - 2] : [0, canvas.width - 1];
        const [topInset, bottomInset] = canvas.height > 2 ? [1, canvas.height - 2] : [0, canvas.height - 1];
        const corners = [[leftInset, topInset], [rightInset, topInset], [leftInset, bottomInset], [rightInset, bottomInset]];
        results.push({ width: canvas.width, height: canvas.height,
          ink: right < 0 ? null : { left, right, top, bottom },
          corners: corners.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]),
        });
      } finally { URL.revokeObjectURL(url); }
    }
    return results;
  }, { png: [...png], svg: [...svg] });
}

async function openCropSetting(page, checked) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const item = page.getByRole('menuitemcheckbox', { name: 'Tight crop for exports', exact: true });
  await expect(item).toHaveAttribute('aria-checked', String(checked));
  return item;
}

async function jpegSize(page, bytes) {
  return page.evaluate(async bytes => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${bytes}`;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, bytes.toString('base64'));
}

function pdfSize(bytes) {
  const [, width, height] = bytes.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  // jsPDF's default conversion from its px unit to PDF points.
  return [Number(width) * 72 / 96, Number(height) * 72 / 96];
}

test('tight crop is opt-in and removes the same border from every export format', async ({ page, app }, testInfo) => {
  const latex = String.raw`\hspace{4em}x\phantom{MMMM}\vphantom{\dfrac{1}{\frac{a}{b}}}`;
  await loadEquation(page, app, latex);
  await page.getByRole('slider', { name: 'Zoom level' }).fill('1.5');

  const setting = await openCropSetting(page, false);
  await page.keyboard.press('Escape');
  await setting.waitFor({ state: 'detached' });
  const paddedPng = await app.save('PNG');
  const paddedJpeg = await app.save('JPEG');
  const paddedSvg = await app.save('SVG');
  const paddedPdf = await app.save('PDF');

  await (await openCropSetting(page, false)).click();
  await setting.waitFor({ state: 'detached' });
  await loadEquation(page, app, latex);
  await openCropSetting(page, true);
  await page.screenshot({ path: testInfo.outputPath('tight-crop-setting.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await setting.waitFor({ state: 'detached' });
  const tightPng = await app.save('PNG');
  const tightJpeg = await app.save('JPEG');
  const tightSvg = await app.save('SVG');
  const tightPdf = await app.save('PDF');

  const padded = await inspectImages(page, paddedPng, paddedSvg);
  const tight = await inspectImages(page, tightPng, tightSvg);
  const removedPadding = 16 * 1.5;
  for (const [i, image] of tight.entries()) {
    expect(padded[i].width - image.width).toBe(2 * removedPadding);
    expect(padded[i].height - image.height).toBe(2 * removedPadding);
    expect(image.ink.left).toBeGreaterThan(removedPadding);
    expect(image.width - image.ink.right).toBeGreaterThan(removedPadding);
    expect(image.height - (image.ink.bottom - image.ink.top + 1)).toBeGreaterThan(removedPadding);
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      expect(padded[i].ink[edge] - image.ink[edge]).toBe(removedPadding);
    }
  }
  const dpr = await page.evaluate(() => Math.max(1, Math.ceil(devicePixelRatio)));
  expect(await jpegSize(page, tightJpeg)).toEqual([tightPng.readUInt32BE(16), tightPng.readUInt32BE(20)]);
  expect(await jpegSize(page, paddedJpeg)).toEqual([
    tightPng.readUInt32BE(16) + 2 * removedPadding * dpr,
    tightPng.readUInt32BE(20) + 2 * removedPadding * dpr,
  ]);
  for (const [i, size] of pdfSize(tightPdf).entries()) {
    expect(pdfSize(paddedPdf)[i] - size).toBeCloseTo(2 * removedPadding * 72 / 96);
    expect(Math.round(size * 96 / 72)).toBe(i === 0 ? tight[1].width : tight[1].height);
  }

  await writeFile(testInfo.outputPath('padded.png'), paddedPng);
  await writeFile(testInfo.outputPath('tight.png'), tightPng);
  await page.getByRole('button', { name: 'Copy image', exact: true }).click();
  await page.waitForFunction(() => window.copiedItems.length);
  const copied = await page.evaluate(async () => [...new Uint8Array(await (await window.copiedItems[0].getType('image/png')).arrayBuffer())]);
  expect(Buffer.from(copied)).toEqual(tightPng);

  await (await openCropSetting(page, true)).click();
  await setting.waitFor({ state: 'detached' });
  expect(await app.save('PNG')).toEqual(paddedPng);
});

test('tight crop keeps blank LaTeX boxes exportable', async ({ page, app }) => {
  await (await openCropSetting(page, false)).click();
  for (const latex of [String.raw`\hspace{4em}`, String.raw`\vphantom{\frac{a}{b}}`]) {
    await loadEquation(page, app, latex);
    const png = await app.save('PNG');
    const svg = await app.save('SVG');
    const [raster, vector] = await inspectImages(page, png, svg);
    for (const image of [raster, vector]) {
      expect(image.ink).toBeNull();
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(latex.includes('hspace') ? image.width : image.height).toBeGreaterThan(16);
    }
  }
});

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
