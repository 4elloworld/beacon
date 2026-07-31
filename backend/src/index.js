import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import queryRouter from './routes/query.js';
import uploadRouter from './routes/upload.js';
import analyzeRouter from './routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '50mb' }));

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
