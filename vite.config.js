import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      }
    }),
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
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
    target: 'es2015',
    minify: 'esbuild'
  },
  server: {
    open: true
  }
});
