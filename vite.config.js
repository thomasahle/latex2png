import { defineConfig } from 'vite';

export default defineConfig({
  base: '/latex2png/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    },
    target: 'es2015',
    minify: 'esbuild'
  },
  server: {
    open: true
  }
});
