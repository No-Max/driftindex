import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mediaOrigin = env.VITE_MEDIA_ORIGIN ?? 'https://driftindex.pro';

  return {
    plugins: [vue()],
    server: {
      port: 5020,
      proxy: {
        '/api': 'http://localhost:5021',
        '/media': {
          target: mediaOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
