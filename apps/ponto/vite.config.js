import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '5173'),
    strictPort: false,
  },
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        reset: resolve(__dirname, 'reset.html'),
      },
    },
  },
});
