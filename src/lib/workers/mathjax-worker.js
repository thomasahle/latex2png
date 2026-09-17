// MathJax Web Worker - uses liteAdaptor (no browser DOM needed)
// This allows MathJax rendering to happen off the main thread

// Catch any errors during worker initialization (import failures, syntax errors, etc.)
// This must be at the very top before any imports that might fail
self.onerror = (message, source, lineno, colno, error) => {
  self.postMessage({
    type: 'init_error',
    error: {
      message: String(message),
      source,
      lineno,
      colno,
      stack: error?.stack
    }
  });
  return true; // Prevent default error handling
};

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/mjs/svg.js';

// Dynamic font loaders - auto-generated, see scripts/generate-font-loaders.mjs
// All fonts are loaded on-demand via mathjax.asyncLoad
import { fontLoaders } from './mathjax-font-loaders.generated.js';

mathjax.asyncLoad = (name) => {
  const fontName = name.match(/dynamic\/([^.]+)\.js/)?.[1];
  if (fontName && fontLoaders[fontName]) {
    return fontLoaders[fontName]();
  }
  return Promise.reject(new Error(`Font not found: ${name}`));
};

// Import TeX package configurations
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
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

// Create lite adaptor (works without browser DOM)
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// Create TeX input with packages and custom macros
const tex = new TeX({
  packages: [
    'base', 'ams', 'newcommand', 'noundefined',
    'color', 'boldsymbol', 'mhchem', 'physics', 'braket', 'cancel', 'unicode',
    'configmacros', 'gensymb', 'textcomp'
  ],
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

// Create SVG output - use 'local' fontCache so each SVG is self-contained
const svg = new SVG({
  fontCache: 'local'
});

// Add mhchem font extension for chemistry arrow glyphs
svg.addExtension(MathJaxMhchemFontExtension);

// Create a document for conversion
const html = mathjax.document('', {
  InputJax: tex,
  OutputJax: svg
});

// Serializes MathJax's internal MathML tree to a MathML string (for 'mathml' requests)
const mmlVisitor = new SerializedMmlVisitor();

// Signal that worker is ready
self.postMessage({ type: 'ready' });

// Handle messages from main thread.
// Request types: 'render' (TeX -> SVG string, the default) and 'mathml'
// (TeX -> MathML string, using the same packages and macros).
// Requests are processed strictly one at a time: html.convert()/html.clear()
// share a single MathDocument, and a render that has to wait for a font to
// load must neither be interleaved with, nor finish after, a later one.
// A { type: 'cancel', id } message drops a request that is still queued.
const queue = [];
let processing = false;

self.onmessage = function(e) {
  const message = e.data;
  if (message.type === 'cancel') {
    const index = queue.findIndex((m) => m.id === message.id);
    if (index !== -1) queue.splice(index, 1);
    return;
  }
  queue.push(message);
  processQueue();
};

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      await handleRequest(queue.shift());
    }
  } finally {
    processing = false;
  }
}

// Use async handler with handleRetriesFor to support MathJax operations that require async work
// (e.g., loading fonts for \mathbb, \mathcal, etc.)
async function handleRequest({ id, type = 'render', latex, display }) {
  try {
    let result;
    if (type === 'mathml') {
      // Stop after the TeX -> internal MathML step and serialize that tree
      const node = await mathjax.handleRetriesFor(() =>
        html.convert(latex, { display: display ?? true, end: STATE.CONVERT })
      );
      result = mmlVisitor.visitTree(node);
    } else {
      // Convert TeX to SVG, handling any async retries MathJax may need
      const node = await mathjax.handleRetriesFor(() =>
        html.convert(latex, { display: display ?? true })
      );

      // Get the outer HTML
      result = adaptor.outerHTML(node);
    }

    // Clear the document for next conversion
    html.clear();

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
}
