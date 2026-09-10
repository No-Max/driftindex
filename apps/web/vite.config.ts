import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5020,
    proxy: {
      '/api': 'http://localhost:5021',
      '/media': 'http://localhost:5021',
    },
  },
});
