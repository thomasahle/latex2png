import { test, expect } from './fixtures.mjs';

for (const failure of ['throw', 'error event']) {
  test(`concurrent drag preparation handles a reader ${failure} and can retry`, async ({ page, app }) => {
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
    await page.evaluate(failure => {
      const NativeReader = window.FileReader;
      window.failedDragReads = 0;
      window.FileReader = class {
        readAsDataURL() {
          window.failedDragReads++;
          this.error = new DOMException('Interrupted image read', 'NotReadableError');
          if (failure === 'throw') throw this.error;
          queueMicrotask(() => this.onerror());
        }
      };
      window.restoreDragReader = () => { window.FileReader = NativeReader; };
    }, failure);
    const source = page.locator('#math-preview');
    const prepare = () => source.evaluate(element => {
      // Pointer events can overlap the scheduled background preparation. Use
      // the real component handler so this also covers the production bundle.
      for (let i = 0; i < 3; i++) element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    try {
      // Invalidate the cached image without changing the equation.
      await page.getByRole('slider', { name: 'Zoom level' }).fill('2');
      await prepare();
      await expect.poll(() => page.evaluate(() => window.failedDragReads)).toBeGreaterThan(0);
      await expect(page.locator('#formula-drag-image')).toHaveCount(0);
    } finally {
      await page.evaluate(() => window.restoreDragReader());
    }
    await prepare();
    await page.waitForFunction(() => document.querySelector('#formula-drag-image')?.naturalWidth > 0);
    const result = await source.evaluate(element => {
      const dataTransfer = new DataTransfer();
      const allowed = element.dispatchEvent(new DragEvent('dragstart', { dataTransfer, cancelable: true }));
      element.dispatchEvent(new DragEvent('dragend'));
      return { allowed, latex: dataTransfer.getData('text/plain'), png: dataTransfer.getData('text/uri-list'), files: [...dataTransfer.files].map(file => file.type) };
    });
    expect(result.allowed).toBe(true);
    expect(result.latex).toBe('x');
    expect(result.png).toMatch(/^data:image\/png;base64,/);
    expect(result.files).toEqual(['image/png']);
    await expect(app.editor).toHaveText('x');
  });
}
