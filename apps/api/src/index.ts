import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { getMediaPublicBase, getMediaRoot } from './lib/media/config.js';
import { createMediaRemoteProxy } from './lib/media/remoteProxy.js';
import { isResponseCacheEnabled, responseCacheTtlMs } from './lib/responseCache.js';
import { authRouter } from './routes/auth.js';
import { homeRouter } from './routes/home.js';
import { pollsRouter } from './routes/polls.js';
import { publicRouter } from './routes/public.js';

const app = express();
const port = Number(process.env.PORT ?? 5021);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5020')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  getMediaPublicBase(),
  express.static(getMediaRoot(), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    fallthrough: true,
  }),
);
const mediaRemoteOrigin = process.env.MEDIA_REMOTE_ORIGIN?.trim();
if (process.env.NODE_ENV !== 'production' && mediaRemoteOrigin) {
  app.use(getMediaPublicBase(), createMediaRemoteProxy(mediaRemoteOrigin));
}
app.use('/api', authRouter);
app.use('/api', pollsRouter);
app.use('/api', publicRouter);
app.use('/api', homeRouter);

app.listen(port, () => {
  const cacheLabel = isResponseCacheEnabled()
    ? `on (ttl ${responseCacheTtlMs()}ms)`
    : 'off';
  console.log(`Drift Index API listening on http://localhost:${port}`);
  console.log(`Response cache: ${cacheLabel}`);
});
