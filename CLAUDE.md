# LaTeX2PNG Project Guidelines

## Build & Development
- This is a static web application with no build process
- Run one of these local servers to test:
  - `python -m http.server`
  - `npx http-server`
- For mobile testing, use responsive design mode in browser devtools

## Project Structure
- `index.html`: Main HTML with semantic structure and external dependencies
- `style.css`: CSS using variables for theming (light/dark) with responsive design
- `script.js`: Vanilla JS with ES6+ syntax handling UI interaction and image conversion
- External deps: MathJax, CodeMirror, html2canvas (loaded via CDN)

## Code Style Guidelines
- **HTML**: Semantic elements, double quotes for attributes, proper meta tags
- **CSS**: Kebab-case class names, mobile-first, CSS variables for theming
- **JavaScript**: 
  - ES6+ with const/let (no var), arrow functions, async/await
  - Event listeners with addEventListener (no inline handlers)
  - localStorage for user preferences
  - Try/catch for error handling
  - Thorough browser compatibility checks

## Error Handling & Accessibility
- Check for browser API support before using features (e.g., Web Share API)
- Provide fallbacks for unsupported features
- Console error logging with meaningful messages
- User-friendly error messages
- Mobile-responsive UI with appropriate touch targets