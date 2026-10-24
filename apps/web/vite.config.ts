import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Served from https://<user>.github.io/POE-Tools/ on GitHub Pages.
export default defineConfig({
  base: '/POE-Tools/',
  plugins: [react(), tailwindcss()],
  test: { name: 'web', environment: 'jsdom' },
});
