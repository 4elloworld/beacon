import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { BEACON_SYSTEM_PROMPT } from '../prompts/system.js';

const router = Router();
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

router.post('/', async (req, res) => {
  const { question, portfolioData, ownerContext, uploadDescription } = req.body;

  if (!question) return res.status(400).json({ error: 'question is required' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: BEACON_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildContext(question, portfolioData, ownerContext, uploadDescription),
      }],
    });

    res.json({ response: message.content[0].text });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(502).json({ error: 'Analysis unavailable — please try again in a moment.' });
  }
});

function buildContext(question, data, mindContext, uploadDesc) {
  return `
OWNER CONTEXT:
${mindContext || 'Not provided'}

UPLOADED DATA DESCRIPTION:
${uploadDesc || 'AppFolio transaction history'}

PORTFOLIO SUMMARY:
- Properties: ${data?.propertyCount ?? 'unknown'}
- Date range: ${data?.dateRange ?? 'unknown'}
- Total rent collected: ${data?.totalRent ?? 'unknown'}
- Total expenses: ${data?.totalExpenses ?? 'unknown'}
- Net position: ${data?.netPosition ?? 'unknown'}
- Flags detected: ${data?.flagCount ?? 'unknown'}

RELEVANT TRANSACTIONS:
${data?.relevantTransactions ?? 'Not provided'}

QUESTION:
${question}
`.trim();
}

export default router;
