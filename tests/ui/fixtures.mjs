import assert from 'node:assert/strict';
import { test as base } from 'playwright/test';
import { chooseExportOption } from '../../scripts/export-controls.mjs';

export { expect } from 'playwright/test';
export const baseUrl = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
export const formula = String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`;
export const test = base.extend({
  app: async ({ page }, use) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => {
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
      await page.getByRole('region', { name: 'Equation preview' }).click({ button: 'right' });
    }
    async function save(format, newLatex) {
      await chooseExportOption(page, 'Export format', format);
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

    await page.goto(`${baseUrl}?latex=x`);
    await ready();
    await use({ editor, preview, ready, setEquation, openSaveMenu, save });
    assert.deepEqual(pageErrors, [], 'no uncaught errors');
  },
});

export function pdfContent(buffer) {
  // Ignore timestamps and document IDs, but compare page dimensions and paths.
  return buffer.toString('latin1').replace(/\/CreationDate \([^)]*\)/g, '')
    .replace(/\/ID \[.*?\]/gs, '');
}
