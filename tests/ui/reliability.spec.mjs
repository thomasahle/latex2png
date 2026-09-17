import { test, expect } from 'playwright/test';
import lzString from 'lz-string';
const { compressToEncodedURIComponent } = lzString;
import { baseUrl } from './fixtures.mjs';

async function ready(page) {
  await expect(page.locator('#preview-scroll')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#math-preview svg')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('an edit followed by immediate navigation is saved for the next visit', async ({ page }) => {
  await page.goto(baseUrl);
  await ready(page);
  await page.getByRole('textbox', { name: 'LaTeX equation' }).fill('recent edit');
  // Navigate before the one-second write debounce expires.
  await page.goto('about:blank');
  await page.goto(baseUrl);
  await ready(page);
  await expect(page.getByRole('textbox', { name: 'LaTeX equation' })).toHaveText('recent edit');
});

test('compressed shared links initialize before the first editor value', async ({ page }) => {
  const equation = String.raw`\frac{x^2}{2}`;
  await page.goto(`${baseUrl}?z=${compressToEncodedURIComponent(equation)}&v=1`);
  await expect(page.getByRole('textbox', { name: 'LaTeX equation' })).toHaveText(equation);
  await ready(page);
});

test('invalid saved settings and denied storage do not prevent editing or export', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const key of ['paneSizes', 'workspaceHeight', 'zoomLevel', 'theme', 'layout', 'equationHistory', 'exportSettings', 'latexRecentCommands']) {
      try { localStorage.setItem(key, '{invalid'); } catch {} // The next load tests denied storage.
    }
  });
  await page.goto(`${baseUrl}?latex=x`);
  await ready(page);
  await expect(page.getByRole('slider', { name: 'Zoom level' })).toHaveValue('1.5');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await page.reload();
  await ready(page);
  const editor = page.getByRole('textbox', { name: 'LaTeX equation' });
  await editor.fill('x^2');
  await ready(page);
  await page.getByRole('button', { name: 'Insert math symbol', exact: true }).click();
  await page.keyboard.press('Escape');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('latex-equation.png');
  expect(errors).toEqual([]);
});

test('worker startup failure retries automatically and later equations render', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let attempts = 0;
    window.Worker = class {
      constructor(url, options) {
        if (++attempts > 1) return new NativeWorker(url, options);
        setTimeout(() => this.onmessage?.({ data: { type: 'init_error', error: { message: 'QA startup failure' } } }), 500);
      }
      terminate() {}
      postMessage() {}
    };
  });
  await page.goto(`${baseUrl}?latex=x`);
  await ready(page);
  await page.getByRole('textbox', { name: 'LaTeX equation' }).fill('x^2');
  await ready(page);
  expect(errors).toEqual([]);
});
