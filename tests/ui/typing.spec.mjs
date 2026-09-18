import { test, expect } from './fixtures.mjs';

test('Backspace removes empty bracket pairs together and undo restores the pair', async ({ page, app }, testInfo) => {
  for (const [opening, closing] of [['{', '}'], ['(', ')'], ['[', ']']]) {
    await app.editor.fill('x');
    await app.editor.pressSequentially(opening);
    await expect(app.editor).toHaveText(`x${opening}${closing}`);
    // Pause beyond CodeMirror's typing group so undo targets this deletion.
    await page.waitForTimeout(600);
    await app.editor.press('Backspace');
    await expect(app.editor).toHaveText('x');
    await app.editor.press('ControlOrMeta+z');
    await expect(app.editor).toHaveText(`x${opening}${closing}`);
    await app.editor.press('ControlOrMeta+Shift+z');
    await expect(app.editor).toHaveText('x');
  }

  await app.editor.pressSequentially('({');
  await expect(app.editor).toHaveText('x({})');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x()');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x');
  await app.ready();

  await app.editor.fill('');
  await app.editor.pressSequentially('{');
  await app.editor.press('Backspace');
  await expect(app.editor.locator('.cm-placeholder')).toBeVisible();
  await expect(app.preview).toHaveAttribute('aria-busy', 'false');
  await expect(app.editor).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#latex-feedback')).toBeEmpty();
  await page.screenshot({ path: testInfo.outputPath('empty-pair-deleted.png'), animations: 'disabled' });
});

test('paired deletion preserves ordinary Backspace, selections, and closing-bracket overtyping', async ({ page, app }) => {
  await app.editor.fill('x+y');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x+');

  await app.editor.fill('x{abc}');
  await app.editor.press('ArrowLeft');
  for (let i = 0; i < 3; i++) await app.editor.press('Shift+ArrowLeft');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x{}');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x');

  await app.editor.fill('x(]');
  await app.editor.press('ArrowLeft');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x]');

  await app.editor.fill('x');
  await app.editor.pressSequentially('{}');
  await expect(app.editor).toHaveText('x{}');
  // The closing key moved past the auto-inserted brace; delete only that brace.
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x{');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText('x');
  await app.ready();
});

test('autocomplete still fills fraction fields and allows editing inside braces', async ({ page, app }) => {
  await app.editor.fill('');
  await app.editor.pressSequentially(String.raw`\fra`);
  await expect(page.getByRole('option', { name: /^\\frac/ })).toBeVisible();
  // Completion ignores keys for its first 75 ms to avoid accidental acceptance.
  await page.waitForTimeout(100);
  await app.editor.press('Enter');
  await expect(app.editor).toHaveText(String.raw`\frac{}{}`);
  await app.editor.pressSequentially('1');
  await app.editor.press('Tab');
  await app.editor.pressSequentially('2');
  await expect(app.editor).toHaveText(String.raw`\frac{1}{2}`);
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText(String.raw`\frac{1}{}`);
  await app.editor.pressSequentially('3');
  await expect(app.editor).toHaveText(String.raw`\frac{1}{3}`);
  await app.ready();
});

test('Vim normal mode keeps navigation keys while insert mode supports paired deletion', async ({ page, app }, testInfo) => {
  const source = 'x+y\na+b';
  await app.setEquation(source);
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  await page.getByRole('menuitem', { name: 'Enable Vim Mode', exact: true }).click();
  await app.editor.focus();
  await app.editor.press('Escape');
  await app.editor.pressSequentially('gg$');
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText(source, { useInnerText: true });
  await app.editor.press('Enter');
  await expect(app.editor).toHaveText(source, { useInnerText: true });
  await app.editor.press('A');
  await app.editor.pressSequentially('{');
  await expect(app.editor).toHaveText(`${source}{}`, { useInnerText: true });
  await app.editor.press('Backspace');
  await expect(app.editor).toHaveText(source, { useInnerText: true });
  await app.editor.press('Escape');
  await app.editor.pressSequentially('gg0lx');
  await expect(app.editor).toHaveText('xy\na+b', { useInnerText: true });
  await app.editor.press('u');
  await expect(app.editor).toHaveText(source, { useInnerText: true });
  await app.ready();
  await page.screenshot({ path: testInfo.outputPath('vim-navigation.png'), animations: 'disabled' });

  await settings.click();
  await page.getByRole('menuitem', { name: 'Disable Vim Mode', exact: true }).click();
  await app.editor.fill('x');
  await app.editor.pressSequentially('{');
  await app.editor.press('Backspace');
  await app.editor.pressSequentially('y');
  await expect(app.editor).toHaveText('xy');
  await app.ready();
});
