import { Router } from 'express';
import multer from 'multer';
import { cleanRow } from '../lib/dataClean.js';
import { runAnomalyDetection } from '../lib/anomalyDetector.js';
import { parseAddress } from '../lib/addressParser.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csv = req.file.buffer.toString('utf-8');

  // Light server-side parse for storage — full parse already done client-side
  const lines = csv.split('\n').filter(Boolean);
  const rowCount = Math.max(0, lines.length - 1);

  res.json({ rowCount, filename: req.file.originalname });
});

export default router;
