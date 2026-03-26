import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: './',
  server: {
    port: 9173,
    proxy: { '/api': 'http://localhost:9002', '/uploads': 'http://localhost:9002' }
  }
});
