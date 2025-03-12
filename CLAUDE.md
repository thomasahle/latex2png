# LaTeX2PNG Project Guidelines

## Build & Development
- Static web application with no build process
- Local development servers:
  - `python -m http.server` (preferred)
  - `npx http-server`
- Device testing: Use browser dev tools responsive mode
- Debugging: Check browser console for errors

## Code Style Guidelines
- **HTML**: 
  - Semantic elements, double quotes for attributes
  - Proper meta tags and accessibility attributes
- **CSS**: 
  - Kebab-case class names (e.g., `editor-container`)
  - Mobile-first design (min-width media queries)
  - CSS variables for theming in :root
- **JavaScript**: 
  - ES6+ features: const/let (no var), arrow functions, async/await
  - Event delegation pattern with addEventListener (no inline handlers)
  - Debounce performance-critical functions
  - Utilize localStorage for persistent settings
  - Feature detection before using browser APIs
  - Structured error handling with try/catch and user feedback

## External Dependencies
- Load all dependencies via CDN with integrity hashes when possible
- MathJax 3: LaTeX rendering engine
- CodeMirror 5: Code editor with syntax highlighting
  - Current options: stex mode, lineNumbers, matchBrackets, theme
  - Enhancement options: autoCloseBrackets, styleActiveLine, lineWrapping, extraKeys
  - LaTeX-specific addons: custom snippets, environment support, keyboard shortcuts
- html2canvas: DOM-to-image conversion
- Phosphor Icons: UI iconography

## Project Roadmap (from TODO)
- See TODO file for completed features and planned improvements
- Add features that enhance usability without complicating the interface