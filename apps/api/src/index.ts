import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { getMediaPublicBase, getMediaRoot } from './lib/media/config.js';
import { homeRouter } from './routes/home.js';
import { publicRouter } from './routes/public.js';

const app = express();
const port = Number(process.env.PORT ?? 5021);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5020')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins }));
app.use(express.json());
app.use(
  getMediaPublicBase(),
  express.static(getMediaRoot(), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    fallthrough: true,
  }),
);
app.use('/api', publicRouter);
app.use('/api', homeRouter);

app.listen(port, () => {
  console.log(`Drift Index API listening on http://localhost:${port}`);
});
