import { test, expect } from './fixtures.mjs';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

const failures = {
  draw: 'The browser could not draw the image.',
  decode: 'Could not load the rendered equation image. Please try again.',
  context: 'Your browser could not create an image. Please try again.',
  encode: 'Could not encode the image.',
};

for (const action of ['PNG', 'JPEG', 'Copy']) {
  test(`${action} recovers from drawing, decoding, canvas, and encoding failures`, async ({ page, app }, testInfo) => {
    if (action === 'JPEG') await chooseExportOption(page, 'Export format', 'JPEG');
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
    const control = page.getByRole('button', { name: action === 'Copy' ? 'Copy image' : `Download ${action}`, exact: true });
    const downloads = [];
    page.on('download', download => downloads.push(download));

    for (const [failure, message] of Object.entries(failures)) {
      const previousDownloads = downloads.length;
      const previousHistory = await page.evaluate(() => localStorage.getItem('equationHistory'));
      await page.evaluate(failure => {
        const nativeDraw = CanvasRenderingContext2D.prototype.drawImage;
        const nativeContext = HTMLCanvasElement.prototype.getContext;
        const nativeEncode = HTMLCanvasElement.prototype.toBlob;
        const nativeCreate = URL.createObjectURL;
        const nativeRevoke = URL.revokeObjectURL;
        window.exportUrls = { created: [], revoked: [] };
        window.copiedItems = [];
        URL.createObjectURL = blob => {
          const isSvg = blob.type.startsWith('image/svg+xml');
          const url = nativeCreate.call(URL, failure === 'decode' && isSvg ? new Blob(['invalid SVG'], { type: blob.type }) : blob);
          if (isSvg) window.exportUrls.created.push(url);
          return url;
        };
        URL.revokeObjectURL = url => {
          window.exportUrls.revoked.push(url);
          nativeRevoke.call(URL, url);
        };
        if (failure === 'draw') CanvasRenderingContext2D.prototype.drawImage = function () {
          throw new DOMException('The browser could not draw the image.', 'InvalidStateError');
        };
        if (failure === 'context') HTMLCanvasElement.prototype.getContext = () => null;
        if (failure === 'encode') HTMLCanvasElement.prototype.toBlob = callback => queueMicrotask(() => callback(null));
        window.restoreExportPipeline = () => {
          CanvasRenderingContext2D.prototype.drawImage = nativeDraw;
          HTMLCanvasElement.prototype.getContext = nativeContext;
          HTMLCanvasElement.prototype.toBlob = nativeEncode;
          URL.createObjectURL = nativeCreate;
          URL.revokeObjectURL = nativeRevoke;
        };
      }, failure);
      try {
        await control.click();
        const error = page.locator('[data-sonner-toast][data-type="error"]').filter({
          hasText: `${action === 'Copy' ? 'Failed to copy image' : 'Download failed'}: ${message}`,
        });
        await expect(error).toBeVisible();
        await expect(control).toBeEnabled();
        await expect(control.locator('.animate-spin')).toHaveCount(0);
        await expect(app.editor).toHaveText('x');
        expect(downloads.length).toBe(previousDownloads);
        expect(await page.evaluate(() => localStorage.getItem('equationHistory'))).toBe(previousHistory);
        expect(await page.evaluate(() => window.copiedItems.length)).toBe(0);
        expect(await page.evaluate(() => window.exportUrls.created.every(url => window.exportUrls.revoked.includes(url)))).toBe(true);
        if (failure === 'draw') await page.screenshot({ path: testInfo.outputPath('drawing-error.png'), animations: 'disabled' });
      } finally {
        await page.evaluate(() => window.restoreExportPipeline());
      }

      // Recover on the same page, with the same formula and export settings.
      if (action === 'Copy') {
        await control.click();
        await expect(control).toHaveText('Copied');
        expect(await page.evaluate(() => window.copiedItems.length)).toBe(1);
      } else {
        const downloaded = page.waitForEvent('download');
        await control.click();
        const download = await downloaded;
        expect(await download.failure()).toBeNull();
        expect(download.suggestedFilename()).toBe(`latex-equation.${action === 'PNG' ? 'png' : 'jpg'}`);
        await expect(control).toBeEnabled();
      }
    }
  });
}
