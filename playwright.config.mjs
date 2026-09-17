import { defineConfig, devices } from 'playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// macOS 27 protects Firefox's normal app data even with a fresh -profile.
// Keep automated browsers entirely in disposable data directories.
// https://bugzilla.mozilla.org/show_bug.cgi?id=2060476
const firefoxData = process.platform === 'darwin' ? mkdtempSync(join(tmpdir(), 'latex2png-firefox-')) : null;
if (firefoxData) process.once('exit', () => rmSync(firefoxData, { recursive: true, force: true }));

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 15_000,
    viewport: { width: 1280, height: 844 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    ...['chromium', 'firefox', 'webkit'].map(browserName => ({
      name: browserName,
      use: { browserName, ...(browserName === 'firefox' && firefoxData ? {
        launchOptions: { env: { ...process.env, MOZ_APP_DATA: firefoxData } },
      } : {}) },
      testIgnore: '**/mobile.spec.mjs',
    })),
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], browserName: 'chromium' }, testMatch: '**/mobile.spec.mjs' },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'], browserName: 'webkit' }, testMatch: '**/mobile.spec.mjs' },
  ],
});
