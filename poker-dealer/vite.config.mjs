import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Express server renders the HTML shell (views/app.ejs) and reads the
// manifest to find the hashed bundle, so there is no index.html here.
export default defineConfig({
  root: 'client',
  base: '/app/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: 'client/src/main.jsx' },
  },
});
