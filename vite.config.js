import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: {
          'codemirror': ['codemirror', '@codemirror/view', '@codemirror/state', '@codemirror/commands', '@codemirror/language', '@codemirror/autocomplete'],
          'latex': ['codemirror-lang-latex', '@lezer/highlight']
        }
      }
    },
    target: 'es2015',
    minify: 'esbuild'
  },
  server: {
    open: true
  }
});
