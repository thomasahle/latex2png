import lzString from 'lz-string';
import { test, expect, baseUrl } from './fixtures.mjs';

const saved = String.raw`\frac{x+1}{2}`;
const invalidLinkMessage = 'Could not load the equation from this link.';

async function visit(page, app, suffix = '') {
  // A real departure flushes the saved draft before the next link initializes.
  await page.goto('about:blank');
  await page.goto(`${baseUrl}${suffix}`);
  await app.ready();
}

test('malformed compressed links report failure and preserve the saved equation between visits', async ({ page, app }, testInfo) => {
  await app.setEquation(saved);
  const encoded = lzString.compressToEncodedURIComponent('x^2');
  for (const value of ['abc', encoded.slice(0, -2), encoded + 'extra']) {
    await visit(page, app, `?z=${encodeURIComponent(value)}&v=1`);
    await expect(app.editor).toHaveText(saved);
    await expect(page.getByText(invalidLinkMessage, { exact: true })).toBeVisible();
    await expect(app.editor).toHaveAttribute('aria-invalid', 'false');
    await page.screenshot({ path: testInfo.outputPath(`invalid-link-${value}.png`), animations: 'disabled' });
    await visit(page, app);
    await expect(app.editor).toHaveText(saved);
    expect(await page.evaluate(() => localStorage.getItem('latexContent'))).toBe(saved);
    await expect(page.getByText(invalidLinkMessage, { exact: true })).toHaveCount(0);
  }
});

test('fragment equations survive tracking parameters while explicit query equations take precedence', async ({ page, app }, testInfo) => {
  const latex = 'x^2';
  const encoded = lzString.compressToEncodedURIComponent(latex);
  await app.setEquation(saved);
  for (const hash of [`latex=${encodeURIComponent(latex)}`, `z=${encodeURIComponent(encoded)}&v=1`]) {
    await visit(page, app, `?utm_source=example#${hash}`);
    await expect(app.editor).toHaveText(latex);
    await expect(page.getByText(invalidLinkMessage, { exact: true })).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath('fragment-link.png'), animations: 'disabled' });
  await visit(page, app, `?latex=y%5E3#z=${encoded}`);
  await expect(app.editor).toHaveText('y^3');
  await visit(page, app, `?z=${encoded}#latex=y%5E3`);
  await expect(app.editor).toHaveText(latex);
});

test('an unavailable compression module retains the draft and a subsequent valid visit recovers', async ({ page, app }) => {
  await app.setEquation(saved);
  const encoded = lzString.compressToEncodedURIComponent('x^2');
  await page.route('**/*lz-string*', route => route.abort('failed'));
  await visit(page, app, `?z=${encoded}&v=1`);
  await expect(app.editor).toHaveText(saved);
  await expect(page.getByText(invalidLinkMessage, { exact: true })).toBeVisible();
  await page.unroute('**/*lz-string*');
  await visit(page, app, `?z=${encoded}&v=1`);
  await expect(app.editor).toHaveText('x^2');
  await expect(page.getByText(invalidLinkMessage, { exact: true })).toHaveCount(0);
});

test('explicitly empty plain and compressed links still clear the equation', async ({ page, app }) => {
  for (const suffix of ['?latex=', '?z=Q&v=1']) {
    await app.setEquation(saved);
    await visit(page, app, suffix);
    await expect(app.editor.locator('.cm-placeholder')).toBeVisible();
    await expect(page.getByText(invalidLinkMessage, { exact: true })).toHaveCount(0);
    await visit(page, app);
    await expect(app.editor.locator('.cm-placeholder')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('latexContent'))).toBe('');
  }
});
