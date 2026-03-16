import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    port: 9173,
    proxy: { '/api': 'http://localhost:9002', '/uploads': 'http://localhost:9002' }
  }
});
