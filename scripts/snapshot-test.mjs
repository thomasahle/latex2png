#!/usr/bin/env node
/**
 * Snapshot test for latex2png exports (PNG, JPEG, SVG, PDF) in light and dark themes.
 *
 * Uses Playwright to trigger actual save actions through the UI context menu,
 * intercepting downloads to capture and verify exports.
 *
 * Requires: `playwright` available (e.g. npm install --save-dev playwright).
 *
 * Usage:
 *   UPDATE_SNAPSHOTS=1 npm run test:snap   # generate/update baseline artifacts
 *   npm run test:snap                      # verify current output matches baseline
 */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAP_DIR = path.resolve(__dirname, '../snapshots');
const REF_DIR = path.join(SNAP_DIR, 'reference');
const BASELINE_FILE = path.join(SNAP_DIR, 'baseline.json');
const UPDATE = !!process.env.UPDATE_SNAPSHOTS;
const BASE_URL = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
const START_SERVER = !!process.env.SNAP_START_SERVER;
const PORT = Number(new URL(BASE_URL).port) || 4173;
const LATEX = 'X: {\\color{orange}455} {\\color{blue}blue}';

// Format configs: menu label, file extension, and whether to hash-compare
// PDF has non-deterministic metadata (timestamps) so we only verify it generates
const FORMATS = [
  { label: 'Save PNG', ext: 'png', hashCompare: true },
  { label: 'Save JPEG', ext: 'jpeg', hashCompare: true },
  { label: 'Save SVG', ext: 'svg', hashCompare: true },
  { label: 'Save PDF', ext: 'pdf', hashCompare: false }
];

ensureDirs();

async function main() {
  const server = START_SERVER ? await startDevServer() : null;
  try {
    const browser = await chromium.launch({ headless: true });
    const results = {};
    for (const theme of ['light', 'dark']) {
      results[theme] = await captureTheme(browser, theme);
    }
    await browser.close();

    if (UPDATE || !fs.existsSync(BASELINE_FILE)) {
      writeBaselines(results);
      console.log('Baselines updated.');
      process.exit(0);
    } else {
      verify(results);
    }
  } finally {
    server?.kill();
  }
}

function ensureDirs() {
  fs.mkdirSync(REF_DIR, { recursive: true });
}

function startDevServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'dev', '--', '--host', '--port', PORT, '--clearScreen', 'false'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let resolved = false;
    const onData = (data) => {
      const text = data.toString();
      if (text.includes('Local:') && text.includes(`:${PORT}`)) {
        resolved = true;
        proc.stdout.off('data', onData);
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (data) => {
      if (!resolved) {
        const text = data.toString();
        if (text.toLowerCase().includes('error')) {
          reject(new Error(text));
        }
      }
    });
    proc.on('exit', (code) => {
      if (!resolved) reject(new Error(`dev server exited with code ${code}`));
    });
  });
}

async function captureTheme(browser, theme) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Seed theme and latex before navigation
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch {}
  }, theme);
  await page.addInitScript((latex) => {
    try { localStorage.setItem('latexContent', latex); } catch {}
  }, LATEX);

  await page.goto(`${BASE_URL}?latex=${encodeURIComponent(LATEX)}`);
  await page.waitForSelector('#math-preview mjx-container svg');

  // Give MathJax a moment to fully render
  await page.waitForTimeout(500);

  const artifacts = {};

  for (const format of FORMATS) {
    // Right-click to open context menu
    await page.click('#math-preview', { button: 'right' });

    // Wait for context menu to appear (must be open state, not the force-mounted toolbar)
    await page.waitForSelector('[role="menu"][data-state="open"]', { state: 'visible' });

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click the save option
    await page.click(`[role="menuitem"]:has-text("${format.label}")`);

    // Wait for download and get content
    const download = await downloadPromise;
    const buffer = await streamToBuffer(await download.createReadStream());

    // Store base64 content
    artifacts[format.ext] = buffer.toString('base64');

    // Close context menu if still open (shouldn't be, but just in case)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  await context.close();
  return artifacts;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function hashBase64(b64) {
  return createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
}

function writeBaselines(results) {
  const baseline = { latex: LATEX, themes: {} };

  for (const [theme, data] of Object.entries(results)) {
    baseline.themes[theme] = {
      png: hashBase64(data.png),
      jpeg: hashBase64(data.jpeg),
      svg: hashBase64(data.svg),
      pdf: hashBase64(data.pdf)
    };
    writeArtifact(theme, 'png', data.png);
    writeArtifact(theme, 'jpeg', data.jpeg);
    writeArtifact(theme, 'svg', data.svg);
    writeArtifact(theme, 'pdf', data.pdf);
  }

  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
}

function writeArtifact(theme, ext, base64) {
  const file = path.join(REF_DIR, `${theme}.${ext}`);
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
}

function verify(results) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  let failed = false;

  // Build a map of which formats should be hash-compared
  const hashCompareFormats = new Set(FORMATS.filter(f => f.hashCompare).map(f => f.ext));

  for (const [theme, data] of Object.entries(results)) {
    for (const [format, b64] of Object.entries(data)) {
      // For non-hash-compare formats (like PDF), just verify content exists
      if (!hashCompareFormats.has(format)) {
        if (!b64 || b64.length < 100) {
          console.error(`${theme} ${format}: Empty or too small`);
          failed = true;
        } else {
          console.log(`${theme} ${format}: Generated (${Math.round(b64.length / 1024)}KB, not hash-compared)`);
        }
        continue;
      }

      const actual = hashBase64(b64);
      const expected = baseline.themes?.[theme]?.[format];
      if (!expected) {
        console.error(`Missing baseline for ${theme} ${format}`);
        failed = true;
        continue;
      }
      if (actual !== expected) {
        failed = true;
        const out = path.join(SNAP_DIR, `${theme}.${format}.actual`);
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.error(`Mismatch for ${theme} ${format}. Wrote ${out}`);
      }
    }
  }

  if (failed) {
    process.exitCode = 1;
    console.error('Snapshot test failed. Run UPDATE_SNAPSHOTS=1 npm run test:snap to refresh baselines.');
  } else {
    console.log('Snapshot test passed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
