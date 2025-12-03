// MathJax 4 service - dynamically loaded ESM modules for rendering LaTeX to SVG
// Uses dynamic imports to code-split MathJax into a separate chunk

let mathjaxModule = null;
let mhchemFontExtension = null;
let adaptor = null;
let tex = null;
let svg = null;
let html = null;
let initPromise = null;

// Lazy load MathJax modules
async function loadMathJax() {
  if (mathjaxModule) return;

  const [
    { mathjax },
    { TeX },
    { SVG },
    { browserAdaptor },
    { RegisterHTMLHandler },
    { MathJaxMhchemFontExtension }
  ] = await Promise.all([
    import('@mathjax/src/js/mathjax.js'),
    import('@mathjax/src/js/input/tex.js'),
    import('@mathjax/src/js/output/svg.js'),
    import('@mathjax/src/js/adaptors/browserAdaptor.js'),
    import('@mathjax/src/js/handlers/html.js'),
    import('@mathjax/mathjax-mhchem-font-extension/mjs/svg.js')
  ]);

  // Import TeX package configurations
  await Promise.all([
    import('@mathjax/src/js/input/tex/base/BaseConfiguration.js'),
    import('@mathjax/src/js/input/tex/ams/AmsConfiguration.js'),
    import('@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'),
    import('@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js'),
    import('@mathjax/src/js/input/tex/color/ColorConfiguration.js'),
    import('@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js'),
    import('@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js'),
    import('@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js'),
    import('@mathjax/src/js/input/tex/cancel/CancelConfiguration.js'),
    import('@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js'),
    import('@mathjax/src/js/input/tex/configmacros/ConfigmacrosConfiguration.js')
  ]);

  mathjaxModule = { mathjax, TeX, SVG, browserAdaptor, RegisterHTMLHandler };
  mhchemFontExtension = MathJaxMhchemFontExtension;
}

export function initWorker() {
  if (typeof window === 'undefined') return;

  // Start loading MathJax in background
  if (!initPromise) {
    initPromise = loadMathJax().then(() => {
      const { mathjax, TeX, SVG, browserAdaptor, RegisterHTMLHandler } = mathjaxModule;

      // Create browser adaptor
      adaptor = browserAdaptor();
      RegisterHTMLHandler(adaptor);

      // Create TeX input with packages (configmacros enables the macros option)
      tex = new TeX({
        packages: [
          'base', 'ams', 'newcommand', 'noundefined',
          'color', 'boldsymbol', 'mhchem', 'physics', 'cancel', 'unicode',
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

      // Create SVG output - use 'local' fontCache so each SVG is self-contained with its own <defs>
      svg = new SVG({
        fontCache: 'local'
      });

      // Add mhchem font extension for chemistry arrow glyphs
      svg.addExtension(mhchemFontExtension);

      // Create a document for conversion
      html = mathjax.document('', {
        InputJax: tex,
        OutputJax: svg
      });
    });
  }
}

export async function renderLatexToSvg(latex, display = true) {
  // Ensure MathJax is loaded
  if (!initPromise) {
    initWorker();
  }
  await initPromise;

  // Convert TeX to SVG
  const node = html.convert(latex, { display });

  // Get the outer HTML
  const svgHtml = adaptor.outerHTML(node);

  // Clear the document for next conversion
  html.clear();

  return svgHtml;
}

export function terminateWorker() {
  // Clean up if needed
  if (svg) {
    svg.clearFontCache();
  }
}
