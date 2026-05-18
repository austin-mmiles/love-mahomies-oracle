import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  system?: string;
  messages?: ChatMessage[];
  max_tokens?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
  }

  const body = req.body as ChatRequest;
  if (!body?.messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: body.max_tokens ?? 1000,
        system: body.system ?? '',
        messages: body.messages,
      }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({ error: `Anthropic request failed: ${msg}` });
  }
}
