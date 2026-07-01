import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages 專案頁：https://wmou-ogham.github.io/HypoTree/ */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/HypoTree/' : '/',
  plugins: [react()],
  appType: 'spa',
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true,
  },
}));
