import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mounted into the container at /app/beacon_ai_system_prompt.md via docker-compose volume
export const BEACON_SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../beacon_ai_system_prompt.md'),
  'utf-8'
);
