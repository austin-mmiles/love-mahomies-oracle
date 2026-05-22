import type { VercelRequest, VercelResponse } from '@vercel/node';

// Free-tier Gemini 2.5 Flash: ~1500 req/day, no card required.
// Get a key at https://aistudio.google.com/apikey
const GEMINI_MODEL = 'gemini-2.5-flash';

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
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const body = req.body as ChatRequest;
  if (!body?.messages?.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Gemini uses { role: 'user' | 'model', parts: [{ text }] } — map Claude's
  // 'assistant' role to 'model'.
  const contents = body.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: body.system ? { parts: [{ text: body.system }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: body.max_tokens ?? 1000,
          temperature: 0.7,
        },
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message ?? `Gemini responded ${upstream.status}`,
      });
    }
    // Shape the response so the existing client (which reads
    // data.content[0].text) keeps working unchanged.
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({ error: `Gemini request failed: ${msg}` });
  }
}
