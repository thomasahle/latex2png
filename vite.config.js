import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({
    compilerOptions: {
      runes: true
    }
  })],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      tabbable: path.resolve('./node_modules/tabbable/dist/index.esm.min.js')
    }
  },
  optimizeDeps: {
    include: ['tabbable']
  },
  base: '/latex2png/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    },
    target: 'esnext',
    minify: 'esbuild'
  },
  server: {
    open: true
  }
});
