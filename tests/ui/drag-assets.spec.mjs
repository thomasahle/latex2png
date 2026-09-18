import { test, expect } from './fixtures.mjs';

for (const failure of ['throw', 'error event']) {
  test(`concurrent drag preparation handles a reader ${failure} and can retry`, async ({ page, app }) => {
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
    const result = await page.evaluate(async failure => {
      const { createFormulaDrag } = await import('/latex2png/src/lib/utils/formula-drag.js');
      const NativeReader = window.FileReader;
      let reads = 0;
      window.FileReader = class {
        readAsDataURL() {
          reads++;
          this.error = new DOMException('Interrupted image read', 'NotReadableError');
          if (failure === 'throw') throw this.error;
          queueMicrotask(() => this.onerror());
        }
      };
      let currentUrl;
      const drag = createFormulaDrag({
        getState: () => ({ previewElement: document.querySelector('#math-preview'), currentLatex: 'x', ready: true }),
        onUrl: url => { currentUrl = url; },
      });
      try {
        const attempts = await Promise.allSettled([drag.prepare(), drag.prepare(), drag.prepare()]);
        window.FileReader = NativeReader;
        const url = await drag.prepare();
        const type = (await (await fetch(url)).blob()).type;
        drag.invalidate();
        return { attempts: attempts.map(({ status, value }) => ({ status, value })), reads, type, cleared: currentUrl === null };
      } finally {
        window.FileReader = NativeReader;
        drag.dispose();
      }
    }, failure);
    expect(result.attempts).toEqual(Array(3).fill({ status: 'fulfilled', value: null }));
    expect(result.reads).toBe(1);
    expect(result.type).toBe('image/png');
    expect(result.cleared).toBe(true);
  });
}
