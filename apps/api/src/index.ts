import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { homeRouter } from './routes/home.js';
import { publicRouter } from './routes/public.js';

const app = express();
const port = Number(process.env.PORT ?? 3221);
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3220')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins }));
app.use(express.json());
app.use('/api', publicRouter);
app.use('/api', homeRouter);

app.listen(port, () => {
  console.log(`Drift Index API listening on http://localhost:${port}`);
});
