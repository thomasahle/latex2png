import lzString from 'lz-string';
import { test, expect } from './fixtures.mjs';

async function holdCompression(page) {
  let release;
  let moduleUrl;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/*lz-string*', async route => {
    moduleUrl = route.request().url();
    if (await gate === 'fail') await route.abort('failed');
    else await route.continue();
  });
  return {
    async ready() { await expect.poll(() => moduleUrl).toBeTruthy(); },
    async finish(result) {
      release(result);
      // Wait for the same module promise the sharing action is already awaiting.
      await page.evaluate(url => import(url).catch(() => {}), moduleUrl);
    },
  };
}

async function openShareMenu(page) {
  await page.getByRole('button', { name: 'Share', exact: true }).click();
}

test.beforeEach(async ({ page, context, app }) => {
  // Popups do not inherit page routes. Never contact an external sharing service.
  await context.route('https://**/*', route => route.abort());
  await page.evaluate(() => {
    window.shareEvents = [];
    window.gtag = (_type, name, data) => { if (name === 'share') window.shareEvents.push(data); };
    const open = window.open;
    window.open = (...args) => {
      window.popupActivation = navigator.userActivation.isActive;
      return open(...args);
    };
  });
});

for (const menu of ['header', 'preview']) {
  test(`${menu} Twitter sharing opens immediately and preserves the selected equation while loading`, async ({ page, context, app }) => {
    const latex = String.raw`\frac{x+1}{3} + \text{café}`;
    await app.setEquation(latex);
    const compression = await holdCompression(page);
    let intent;
    await context.route('https://twitter.com/intent/tweet?*', async route => {
      intent = new URL(route.request().url());
      await route.fulfill({ contentType: 'text/html', body: '<p>Sharing destination</p>' });
    });
    if (menu === 'header') await openShareMenu(page);
    else await app.openSaveMenu();
    const opened = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Share to Twitter', exact: true }).click();
    const popup = await opened;
    await compression.ready();
    expect(await page.evaluate(() => window.popupActivation)).toBe(true);
    expect(popup.url()).toBe('about:blank');
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(await page.evaluate(() => window.shareEvents)).toEqual([]);
    await app.enterEquation('y^3');
    await compression.finish();
    await expect(popup.getByText('Sharing destination')).toBeVisible();
    const shared = new URL(intent.searchParams.get('url'));
    expect(lzString.decompressFromEncodedURIComponent(shared.searchParams.get('z'))).toBe(latex);
    expect(shared.searchParams.get('v')).toBe('1');
    expect(shared.origin + shared.pathname).toBe(new URL(page.url()).origin + new URL(page.url()).pathname);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(await page.evaluate(() => window.shareEvents)).toEqual([{ method: 'twitter' }]);
    await expect(app.editor).toHaveText('y^3');
    await popup.close();
  });
}

test('failed share preparation closes its empty window and reports the error', async ({ page, context, app }, testInfo) => {
  const compression = await holdCompression(page);
  await openShareMenu(page);
  const opened = page.waitForEvent('popup');
  await page.getByRole('menuitem', { name: 'Share to Twitter', exact: true }).click();
  const popup = await opened;
  await compression.ready();
  await compression.finish('fail');
  await expect(page.getByText('Failed to open Twitter sharing', { exact: true })).toBeVisible();
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(context.pages()).toEqual([page]);
  expect(await page.evaluate(() => window.shareEvents)).toEqual([]);
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('share-preparation-error.png'), animations: 'disabled' });
});

for (const result of ['ready', 'fail']) {
  test(`closing a pending share window cancels it even if preparation becomes ${result}`, async ({ page, context, app }) => {
    const destinations = [];
    await context.route('https://twitter.com/**', route => { destinations.push(route.request().url()); return route.abort(); });
    const compression = await holdCompression(page);
    await openShareMenu(page);
    const opened = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Share to Twitter', exact: true }).click();
    const popup = await opened;
    await compression.ready();
    await popup.close();
    await compression.finish(result);
    expect(destinations).toEqual([]);
    expect(context.pages()).toEqual([page]);
    expect(await page.evaluate(() => window.shareEvents)).toEqual([]);
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
    await app.setEquation('y');
  });
}

for (const blocked of ['returns null', 'throws']) {
  test(`sharing reports a popup that ${blocked} without preparing or claiming success`, async ({ page, context, app }) => {
    const modules = [];
    await page.route('**/*lz-string*', route => { modules.push(route.request().url()); return route.abort(); });
    await page.evaluate(blocked => {
      window.open = () => {
        if (blocked === 'throws') throw new DOMException('Denied', 'SecurityError');
        return null;
      };
    }, blocked);
    await openShareMenu(page);
    await page.getByRole('menuitem', { name: 'Share to Twitter', exact: true }).click();
    await expect(page.getByText(blocked === 'returns null' ? 'Popup blocked by the browser' : 'Failed to open Twitter sharing', { exact: true })).toBeVisible();
    expect(context.pages()).toEqual([page]);
    expect(modules).toEqual([]);
    expect(await page.evaluate(() => window.shareEvents)).toEqual([]);
  });
}
