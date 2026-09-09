import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3220,
    proxy: {
      '/api': 'http://localhost:3221',
    },
  },
});
