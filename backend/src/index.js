import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import queryRouter from './routes/query.js';
import uploadRouter from './routes/upload.js';
import analyzeRouter from './routes/analyze.js';
import { rateLimit } from './lib/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));

// Both limiters run on /api/query; the tighter one is mounted second so its
// numbers are the ones reported in the RateLimit-* response headers.
// The limits are sized well above what a person clicking through the demo hits.
app.use('/api', rateLimit({
  windowMs: 60_000,
  max: Number(process.env.API_RATE_LIMIT) || 60,
}));

// /api/query bills the Anthropic key on every call, so it gets the tighter cap.
app.use('/api/query', rateLimit({
  windowMs: 60_000,
  max: Number(process.env.QUERY_RATE_LIMIT) || 10,
  message: 'Too many questions in a row — please wait a minute and try again.',
}));

app.use('/api/query', queryRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/analyze', analyzeRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

const distPath = path.join(__dirname, '../public');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Beacon backend running on port ${PORT}`));
