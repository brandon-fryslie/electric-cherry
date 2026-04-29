import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base URL is set explicitly per deploy by the CI workflow so asset paths
// match the versioned subdir gh-pages-multiplexer publishes to. Locally,
// we default to '/' for `npm run dev`.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
