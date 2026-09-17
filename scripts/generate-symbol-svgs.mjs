#!/usr/bin/env node
// Pre-renders toolbar symbol SVGs using MathJax (liteAdaptor, no browser DOM)
// Run: node scripts/generate-symbol-svgs.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// MathJax core (same setup as src/lib/workers/mathjax-worker.js)
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/mjs/svg.js';

// TeX packages match mathjax-worker.js; undefined commands must fail generation.
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js';
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js';

// Toolbar symbol data
import { toolbarCommands } from '../src/lib/utils/toolbarCommands.js';

const outputFile = 'src/lib/utils/symbol-svgs.generated.js';

async function generate() {
  // Set up dynamic font loading (same mechanism as mathjax-worker.js)
  const fontDir = path.resolve('node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic');
  const fontFiles = (await fs.readdir(fontDir)).filter(f => f.endsWith('.js'));
  const fontLoaders = {};
  for (const file of fontFiles) {
    const name = path.basename(file, '.js');
    const url = pathToFileURL(path.join(fontDir, file)).href;
    fontLoaders[name] = () => import(url);
  }

  mathjax.asyncLoad = (name) => {
    const fontName = name.match(/dynamic\/([^.]+)\.js/)?.[1];
    if (fontName && fontLoaders[fontName]) return fontLoaders[fontName]();
    return Promise.reject(new Error(`Font not found: ${name}`));
  };

  // Initialize MathJax
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);

  const tex = new TeX({
    packages: [
      'base', 'ams', 'newcommand',
      'color', 'boldsymbol', 'mhchem', 'physics', 'braket', 'cancel', 'unicode',
      'configmacros', 'gensymb', 'textcomp'
    ],
    formatError: (_jax, error) => { throw error; },
    macros: {
      oiint: "\\unicode{x222F}",
      oiiint: "\\unicode{x2230}",
      Overrightarrow: ["\\overrightarrow{#1}", 1],
      underbar: ["\\underline{#1}", 1],
      utilde: ["\\underset{\\sim}{#1}", 1],
      llbracket: "\\unicode{x27E6}",
      rrbracket: "\\unicode{x27E7}",
      widecheck: ["\\overset{\\Large\\vee}{#1}", 1],
      overgroup: ["\\overbrace{#1}^{\\hspace{-0.5em}}", 1],
      undergroup: ["\\underbrace{#1}_{\\hspace{-0.5em}}", 1],
      overleftharpoon: ["\\overset{\\leftharpoonup}{#1}", 1],
      overrightharpoon: ["\\overset{\\rightharpoonup}{#1}", 1],
      // LaTeX math-mode symbols that MathJax does not define
      P: "\\unicode{x00B6}",
      copyright: "\\unicode{x00A9}",
      // The physics package redefines \div as divergence (nabla-dot); restore the
      // LaTeX division sign. Divergence stays available as \divergence (issue #7).
      div: "\\divisionsymbol"
    }
  });

  const svg = new SVG({ fontCache: 'local' });
  svg.addExtension(MathJaxMhchemFontExtension);

  const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

  // Collect unique labels by render mode
  const displayLabels = new Set();
  const inlineLabels = new Set();

  for (const category of toolbarCommands) {
    displayLabels.add(category.icon);
    for (const cmd of category.commands) {
      displayLabels.add(cmd.label);
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          displayLabels.add(sub.label);
        }
      }
    }
  }

  // Navbar heading uses \LaTeX in inline mode
  inlineLabels.add('\\LaTeX');

  console.log(`Rendering ${displayLabels.size} display + ${inlineLabels.size} inline symbols...`);

  async function renderSymbol(label, display) {
    const node = await mathjax.handleRetriesFor(() =>
      html.convert(label, { display })
    );
    const result = adaptor.outerHTML(node);
    html.clear();
    return result;
  }

  // Render display mode symbols
  const displayMap = {};
  let i = 0;
  for (const label of displayLabels) {
    try {
      displayMap[label] = await renderSymbol(label, true);
    } catch (err) {
      throw new Error(`Failed to render symbol "${label}": ${err.message}`, { cause: err });
    }
    if (++i % 50 === 0) console.log(`  ${i}/${displayLabels.size}...`);
  }

  // Render inline mode symbols
  const inlineMap = {};
  for (const label of inlineLabels) {
    try {
      inlineMap[label] = await renderSymbol(label, false);
    } catch (err) {
      throw new Error(`Failed to render inline symbol "${label}": ${err.message}`, { cause: err });
    }
  }

  // Write output
  const fmt = (map) => Object.entries(map)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');

  const output = `// AUTO-GENERATED by scripts/generate-symbol-svgs.mjs - DO NOT EDIT
// Pre-rendered MathJax SVGs for toolbar symbols
// Regenerate with: node scripts/generate-symbol-svgs.mjs

export const symbolSvgs = {
${fmt(displayMap)}
};

export const symbolSvgsInline = {
${fmt(inlineMap)}
};
`;

  await fs.writeFile(outputFile, output);
  console.log(`\nGenerated ${outputFile}`);
  console.log(`  ${Object.keys(displayMap).length} display symbols`);
  console.log(`  ${Object.keys(inlineMap).length} inline symbols`);
}

generate().catch(err => {
  console.error('Failed to generate symbol SVGs:', err);
  process.exit(1);
});
