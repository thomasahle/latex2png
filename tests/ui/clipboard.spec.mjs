import { test, expect } from './fixtures.mjs';

for (const failure of ['returns false', 'throws', 'permission denied']) {
  test(`text copy reports failure and cleans up when the clipboard ${failure}`, async ({ page, app }, testInfo) => {
    await page.evaluate(failure => {
      window.clipboardAttempts = 0;
      window.shareEvents = [];
      window.gtag = (type, name, data) => { if (type === 'event' && name === 'share') window.shareEvents.push(data); };
      navigator.clipboard.writeText = failure === 'permission denied'
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
    navigator.clipboard.writeText = undefined;
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
