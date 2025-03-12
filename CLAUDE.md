# LaTeX2PNG Project Guidelines

## Build & Development
- This is a simple static web application with no build process
- To test the app, open `index.html` in a browser
- For local development, you can use a simple HTTP server:
  - `python -m http.server`
  - `npx http-server`

## Code Style Guidelines

### HTML
- Use semantic HTML5 elements
- Include proper meta tags for SEO and social sharing
- Use double quotes for HTML attributes

### CSS
- Use kebab-case for class names (e.g., `preview-area`)
- Mobile-first approach with media queries for larger screens
- Organize CSS by component/section with clear comments

### JavaScript
- Use ES6+ syntax with `const`/`let` over `var`
- Use arrow functions for event listeners and callbacks
- Prefer async/await for asynchronous operations
- Handle errors with try/catch blocks
- Use `addEventListener` rather than inline event handlers
- Document complex functions with comments

### General
- Follow consistent 2-space indentation
- Keep code modular and focused on single responsibilities
- Ensure web accessibility standards are followed