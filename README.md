# LaTeX to Image

[![Repository Preview](public/og.png)](https://thomasahle.com/latex2png)

A fast, modern web app to convert LaTeX math equations to PNG, JPEG, SVG, and PDF images. No installation required—just type and export.

**[Try it live →](https://thomasahle.com/latex2png)**

## Features

- 🚀 **Real-time preview** - See your equation render as you type
- 📦 **Multiple export formats** - PNG, JPEG, SVG, and PDF
- 🎨 **GitHub-inspired editor** - Clean themes for light and dark mode
- ⌨️ **Vim mode** - Optional vim keybindings for power users
- 🔍 **Smart autocomplete** - 80+ LaTeX commands with snippets
- 📱 **Fully responsive** - Works on desktop and mobile
- 🌙 **Dark mode** - Easy on the eyes
- 📐 **Adjustable zoom** - Perfect your export size
- 🔒 **Privacy-first** - Everything runs in your browser, no data sent to servers

## Quick Start

Just visit **[thomasahle.com/latex2png](https://thomasahle.com/latex2png)** and start typing!

### Example equations

Try these:
- `\frac{1}{\sqrt{2\pi}} e^{-x^2/2}`
- `\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}`
- `\sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6}`

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Vite** - Fast build tool
- **Svelte 5** - Reactive UI framework
- **CodeMirror 6** - Powerful code editor
- **MathJax 3** - LaTeX rendering
- **Tailwind CSS** - Styling
- **html2canvas** - Image generation

## License

MIT

---

Built by [@thomasahle](https://github.com/thomasahle)
