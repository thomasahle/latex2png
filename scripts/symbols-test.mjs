#!/usr/bin/env node
/**
 * Symbols rendering test for latex2png.
 *
 * Renders all toolbar symbols using MathJax in batches to verify font loading works.
 * Batches ~40 symbols per render to balance efficiency vs MathJax buffer limits.
 *
 * Usage:
 *   npm run test:symbols              # verify all symbols render correctly
 *   UPDATE_SNAPSHOTS=1 npm run test:symbols  # update baseline
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toolbarCommands } from '../src/lib/utils/toolbarCommands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAP_DIR = path.resolve(__dirname, '../snapshots');
const BASELINE_FILE = path.join(SNAP_DIR, 'symbols-baseline.json');
const UPDATE = !!process.env.UPDATE_SNAPSHOTS;
const BASE_URL = process.env.SNAP_BASE_URL || 'http://localhost:5173/latex2png/';
const BATCH_SIZE = 40;

// Extract all symbols from toolbarCommands.js
const SYMBOLS = getSymbols();

function getSymbols() {
  const symbols = new Set();

  function extractLatex(cmd) {
    if (cmd.latex) {
      // Convert template placeholders to simple values for testing
      // e.g., "\\frac{${1}}{${2}}" -> "\\frac{a}{b}"
      let latex = cmd.latex
        .replace(/\$\{1\}/g, 'a')
        .replace(/\$\{2\}/g, 'b')
        .replace(/\$\{3\}/g, 'c')
        .replace(/\$\{4\}/g, 'd')
        .replace(/\$\{5\}/g, 'e')
        .replace(/\$\{6\}/g, 'f')
        .replace(/\$\{7\}/g, 'g')
        .replace(/\$\{8\}/g, 'h')
        .replace(/\$\{9\}/g, 'i');
      symbols.add(latex);
    }
    if (cmd.subcommands) {
      cmd.subcommands.forEach(extractLatex);
    }
  }

  for (const category of toolbarCommands) {
    for (const cmd of category.commands) {
      extractLatex(cmd);
    }
  }

  // Add physics/braket symbols (not in toolbar but important)
  symbols.add('\\ket{\\psi}');
  symbols.add('\\bra{\\phi}');
  symbols.add('\\braket{\\phi|\\psi}');

  // Add chemistry (mhchem) symbols
  symbols.add('\\ce{H2O}');
  symbols.add('\\ce{CO2}');
  symbols.add('\\ce{->}');
  symbols.add('\\ce{<=>}');

  return [...symbols];
}

function createBatchLatex(symbols) {
  // Join symbols with quad spacing, wrap in gathered for vertical stacking
  const rows = [];
  for (let i = 0; i < symbols.length; i += 10) {
    const rowSymbols = symbols.slice(i, i + 10);
    rows.push(rowSymbols.join(' \\quad '));
  }
  return rows.join(' \\\\ ');
}

async function main() {
  const totalSymbols = SYMBOLS.length;
  const batches = [];
  for (let i = 0; i < totalSymbols; i += BATCH_SIZE) {
    batches.push(SYMBOLS.slice(i, i + BATCH_SIZE));
  }

  console.log(`Testing ${totalSymbols} symbols in ${batches.length} batches...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('failed to load') || text.includes('Font not found') || text.includes('MathJax')) {
        errors.push(text);
      }
    }
  });

  let passedBatches = 0;
  let failedBatches = 0;
  const failedSymbols = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchLatex = createBatchLatex(batch);
    const prevErrorCount = errors.length;

    await page.goto(`${BASE_URL}?latex=${encodeURIComponent(batchLatex)}`);

    try {
      // Wait for MathJax to render
      await page.waitForSelector('#math-preview mjx-container svg', { timeout: 10000 });
      // Extra time for dynamic font loading
      await page.waitForTimeout(500);

      // Check for displayed error
      const errorElement = await page.$('[data-mathjax-error]');
      const hasDisplayedError = errorElement !== null;

      // Check for new console errors
      const newErrors = errors.slice(prevErrorCount);
      const hasFontError = newErrors.length > 0;

      if (hasDisplayedError || hasFontError) {
        failedBatches++;
        failedSymbols.push(...batch);
        process.stdout.write('F');
      } else {
        passedBatches++;
        process.stdout.write('.');
      }
    } catch (err) {
      failedBatches++;
      failedSymbols.push(...batch);
      process.stdout.write('F');
    }
  }

  await browser.close();

  console.log('\n');
  console.log(`Results: ${passedBatches}/${batches.length} batches passed`);

  if (failedSymbols.length > 0) {
    console.log(`\nPotentially failed symbols (${failedSymbols.length}):`);
    console.log(failedSymbols.slice(0, 20).join(', ') + (failedSymbols.length > 20 ? '...' : ''));
  }

  if (errors.length > 0) {
    console.log('\nConsole errors:');
    [...new Set(errors)].slice(0, 5).forEach(e => console.log(`  ${e}`));
  }

  // Save/verify baseline
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const result = {
    totalSymbols,
    totalBatches: batches.length,
    passedBatches,
    failedBatches,
    errors: errors.length
  };

  if (UPDATE || !fs.existsSync(BASELINE_FILE)) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(result, null, 2));
    console.log('\nBaseline updated.');
  } else {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    if (failedBatches > baseline.failedBatches) {
      console.error(`\nRegression: ${failedBatches} batches failed (baseline: ${baseline.failedBatches})`);
      process.exitCode = 1;
    } else {
      console.log('\nSymbols test passed.');
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
