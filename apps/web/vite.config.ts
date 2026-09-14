import vue from '@vitejs/plugin-vue';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';

const LOCAL_API = 'http://localhost:5021';

/** Serve /media from local API first, then fall back to production. */
function mediaFallbackProxy(remoteOrigin: string): Plugin {
  return {
    name: 'media-fallback-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/media/')) {
          next();
          return;
        }

        const origins =
          remoteOrigin === LOCAL_API ? [LOCAL_API] : [LOCAL_API, remoteOrigin];

        for (const origin of origins) {
          try {
            const upstream = await fetch(`${origin}${req.url}`);
            if (!upstream.ok) continue;

            res.statusCode = upstream.status;
            upstream.headers.forEach((value, key) => {
              if (key === 'transfer-encoding') return;
              res.setHeader(key, value);
            });
            res.end(Buffer.from(await upstream.arrayBuffer()));
            return;
          } catch {
            // try next origin
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mediaOrigin = env.VITE_MEDIA_ORIGIN ?? 'https://driftindex.pro';

  return {
    plugins: [vue(), mediaFallbackProxy(mediaOrigin)],
    server: {
      port: 5020,
      proxy: {
        '/api': LOCAL_API,
      },
    },
  };
});
