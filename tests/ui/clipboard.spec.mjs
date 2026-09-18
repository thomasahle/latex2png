import { test, expect } from './fixtures.mjs';

for (const action of ['Copy image', 'Copy MathML']) {
  test(`${action} starts during the click and confirms only after the pending data is written`, async ({ page, app }) => {
    await page.evaluate(() => {
      window.workerResponseDelay = 2000;
      const write = navigator.clipboard.write;
      const permission = new Promise(resolve => { window.finishClipboardWrite = resolve; });
      navigator.clipboard.write = async items => {
        window.copyStarted = {
          pending: document.querySelector('#preview-scroll').getAttribute('aria-busy'),
          active: navigator.userActivation.isActive,
        };
        await permission;
        await write(items);
      };
    });
    if (action === 'Copy MathML') await app.openSaveMenu();
    await app.editor.fill(String.raw`\frac{987654321}{2}`);
    const copy = page.getByRole('button', { name: 'Copy image', exact: true });
    const trigger = action === 'Copy image' ? copy : page.getByRole('menuitem', { name: action, exact: true });
    await trigger.click();
    expect(await page.evaluate(() => window.copyStarted)).toEqual({ pending: 'true', active: true });
    await app.ready();
    expect(await page.evaluate(() => window.copiedItems)).toEqual([]);
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    if (action === 'Copy image') {
      await expect(copy).toBeDisabled();
      await expect(copy.locator('svg.lucide-loader-circle')).toBeVisible();
      await expect(page.locator('#preview-actions [role="status"]')).toBeEmpty();
    }
    await page.evaluate(() => window.finishClipboardWrite());
    if (action === 'Copy image') {
      await expect(copy).toHaveText('Copied');
      await expect(copy).toBeEnabled();
      const bytes = await page.evaluate(async () => [...new Uint8Array(await (await window.copiedItems[0].getType('image/png')).arrayBuffer())]);
      expect(Buffer.from(bytes)).toEqual(await app.save('PNG'));
    } else {
      await expect(page.getByText('MathML copied to clipboard!', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.copiedText)).toMatch(/<mfrac[\s\S]*987654321/);
    }
  });

  test(`${action} handles clipboard rejection followed by a rendering error`, async ({ page, app }) => {
    const downloads = [];
    page.on('download', download => downloads.push(download));
    const copy = page.getByRole('button', { name: 'Copy image', exact: true });
    await page.evaluate(() => {
      window.NativeClipboardItem = window.ClipboardItem;
      window.clipboardAttempts = 0;
    });
    for (const failure of ['write', 'constructor']) {
      await page.evaluate(failure => {
        navigator.clipboard.write = async () => {
          window.clipboardAttempts++;
          throw new DOMException('Denied', 'NotAllowedError');
        };
        window.ClipboardItem = failure === 'constructor'
          ? class { constructor() { window.clipboardAttempts++; throw new TypeError('Unsupported'); } }
          : window.NativeClipboardItem;
      }, failure);
      for (const latex of [String.raw`\frac{`, '']) {
        if (action === 'Copy MathML') await app.openSaveMenu();
        await app.editor.fill(latex);
        await (action === 'Copy image' ? copy : page.getByRole('menuitem', { name: action, exact: true })).click();
        const error = page.locator('[data-sonner-toast][data-type="error"]').last();
        await expect(error).toContainText(`Failed to copy ${action === 'Copy image' ? 'image' : 'MathML'}:`);
        if (!latex) await expect(error).toContainText('Enter a LaTeX equation before exporting.');
        await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
        await expect(copy).toBeEnabled();
        await expect(copy).toHaveText('Copy');
        await expect(page.locator('#preview-actions [role="status"]')).toBeEmpty();
        await app.setEquation('x');
      }
    }
    expect(await page.evaluate(() => window.clipboardAttempts)).toBe(4);
    expect(await page.evaluate(() => window.copiedItems)).toEqual([]);
    expect(downloads).toEqual([]);
  });
}

for (const unavailable of ['ClipboardItem', 'write']) {
  test(`MathML still copies with writeText when ${unavailable} is unavailable`, async ({ page, app }) => {
    await page.evaluate(unavailable => {
      if (unavailable === 'ClipboardItem') window.ClipboardItem = undefined;
      else navigator.clipboard.write = undefined;
    }, unavailable);
    await app.openSaveMenu();
    await app.editor.fill(String.raw`\frac{123456789}{2}`);
    await page.getByRole('menuitem', { name: 'Copy MathML', exact: true }).click();
    await expect(page.getByText('MathML copied to clipboard!', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.copiedText)).toMatch(/<mfrac[\s\S]*123456789/);
  });
}

for (const failure of ['returns false', 'throws', 'permission denied']) {
  test(`text copy reports failure and cleans up when the clipboard ${failure}`, async ({ page, app }, testInfo) => {
    await page.evaluate(failure => {
      window.clipboardAttempts = 0;
      window.shareEvents = [];
      window.gtag = (type, name, data) => { if (type === 'event' && name === 'share') window.shareEvents.push(data); };
      navigator.clipboard.write = navigator.clipboard.writeText = failure === 'permission denied'
        ? async () => { throw new DOMException('Denied', 'NotAllowedError'); }
        : undefined;
      document.execCommand = () => {
        window.clipboardAttempts++;
        if (failure === 'throws') throw new Error('Clipboard denied');
        return false;
      };
    }, failure);
    const share = page.getByRole('button', { name: 'Share', exact: true });
    await share.click();
    await page.getByRole('menuitem', { name: 'Copy Link', exact: true }).click();
    await expect(page.getByText('Failed to copy link', { exact: true })).toBeVisible();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await expect(page.locator('body > input, body > textarea')).toHaveCount(0);
    await expect(share).toBeFocused();

    await app.openSaveMenu();
    await page.getByRole('menuitem', { name: 'Copy MathML', exact: true }).click();
    await expect(page.getByText(/^Failed to copy MathML:/)).toBeVisible();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveCount(0);
    await expect(page.locator('body > input, body > textarea')).toHaveCount(0);
    await expect(app.preview).toBeFocused();
    expect(await page.evaluate(() => window.shareEvents)).toEqual([]);
    expect(await page.evaluate(() => window.clipboardAttempts)).toBe(failure === 'permission denied' ? 0 : 2);
    await page.screenshot({ path: testInfo.outputPath('clipboard-error.png'), animations: 'disabled' });
  });
}

test('text copy fallback preserves the complete text and preview focus after a pending render', async ({ page, app }) => {
  const latex = String.raw`\frac{x+1}{3}`;
  await app.setEquation(latex);
  await app.openSaveMenu();
  await page.getByRole('menuitem', { name: 'Copy MathML', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.copiedText)).toContain('<mfrac');
  const expectedMathML = await page.evaluate(() => window.copiedText);
  await app.setEquation('y');
  await page.evaluate(() => {
    navigator.clipboard.write = navigator.clipboard.writeText = undefined;
    window.legacyCopies = [];
    document.execCommand = command => {
      const input = document.activeElement;
      window.legacyCopies.push({ command, text: input.value.slice(input.selectionStart, input.selectionEnd) });
      return true;
    };
  });
  const share = page.getByRole('button', { name: 'Share', exact: true });
  await share.click();
  await page.getByRole('menuitem', { name: 'Copy Link', exact: true }).click();
  await expect(page.getByText('Link copied!', { exact: true })).toBeVisible();
  await expect(share).toBeFocused();
  const link = (await page.evaluate(() => window.legacyCopies))[0];
  expect(link.command).toBe('copy');
  expect(new URL(link.text).searchParams.get('latex')).toBe('y');

  await app.openSaveMenu();
  await app.editor.fill(latex);
  await expect(app.preview).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('menuitem', { name: 'Copy MathML', exact: true }).click();
  await expect(page.getByText('MathML copied!', { exact: true })).toBeVisible();
  await expect(app.preview).toBeFocused();
  expect((await page.evaluate(() => window.legacyCopies))[1]).toEqual({ command: 'copy', text: expectedMathML });
  await expect(page.locator('body > input, body > textarea')).toHaveCount(0);
});
