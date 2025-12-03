// MathJax Web Worker - uses liteAdaptor (no browser DOM needed)
// This allows MathJax rendering to happen off the main thread

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/mjs/svg.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/mjs/svg.js';

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

// Create lite adaptor (works without browser DOM)
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// Create TeX input with packages and custom macros
const tex = new TeX({
  packages: [
    'base', 'ams', 'newcommand', 'noundefined',
    'color', 'boldsymbol', 'mhchem', 'physics', 'braket', 'cancel', 'unicode',
    'configmacros'
  ],
  macros: {
    oiint: "\\unicode{x222F}",
    oiiint: "\\unicode{x2230}",
    Overrightarrow: ["\\overrightarrow{#1}", 1],
    utilde: ["\\underset{\\sim}{#1}", 1],
    llbracket: "\\unicode{x27E6}",
    rrbracket: "\\unicode{x27E7}",
    widecheck: ["\\overset{\\Large\\vee}{#1}", 1],
    overgroup: ["\\overbrace{#1}^{\\hspace{-0.5em}}", 1],
    undergroup: ["\\underbrace{#1}_{\\hspace{-0.5em}}", 1],
    overleftharpoon: ["\\overset{\\leftharpoonup}{#1}", 1],
    overrightharpoon: ["\\overset{\\rightharpoonup}{#1}", 1]
  }
});

// Create SVG output
// Use 'local' fontCache so each SVG is self-contained
const svg = new SVG({
  fontCache: 'local',
  font: new MathJaxNewcmFont()
});

// Add mhchem font extension for chemistry arrow glyphs
svg.addExtension(MathJaxMhchemFontExtension);

// Create a document for conversion
const html = mathjax.document('', {
  InputJax: tex,
  OutputJax: svg
});

// Signal that worker is ready
self.postMessage({ type: 'ready' });

// Handle messages from main thread
// Use async handler with handleRetriesFor to support MathJax operations that require async work
// (e.g., loading fonts for \mathbb, \mathcal, etc.)
self.onmessage = async function(e) {
  const { id, latex, display } = e.data;

  try {
    // Convert TeX to SVG, handling any async retries MathJax may need
    const node = await mathjax.handleRetriesFor(() =>
      html.convert(latex, { display: display ?? true })
    );

    // Get the outer HTML
    const svgString = adaptor.outerHTML(node);

    // Clear the document for next conversion
    html.clear();

    self.postMessage({ id, success: true, svg: svgString });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
