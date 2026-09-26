import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxImportSource: 'react' })],
  base: './',
  publicDir: 'public',
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
  build: { outDir: '../../public/afterworld', emptyOutDir: false },
});
