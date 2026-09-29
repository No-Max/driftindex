import type { RequestHandler } from 'express';
import { getMediaPublicBase } from './config.js';

/** In dev, serve missing files from production media (e.g. driftindex.pro). */
export function createMediaRemoteProxy(remoteOrigin: string): RequestHandler {
  const base = getMediaPublicBase();
  const origin = remoteOrigin.replace(/\/$/, '');

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const publicPath = `${req.baseUrl}${req.path}`.replace(/\/+/g, '/');
    if (!publicPath.startsWith(`${base}/`)) {
      next();
      return;
    }

    try {
      const upstream = await fetch(`${origin}${publicPath}`, { method: req.method });
      if (!upstream.ok) {
        next();
        return;
      }

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (key === 'transfer-encoding') return;
        res.setHeader(key, value);
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      next();
    }
  };
}
