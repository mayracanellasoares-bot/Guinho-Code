const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Missing GROQ_API_KEY' });
    return;
  }

  try {
    const body = req.body || {};
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || MODEL,
        messages: Array.isArray(body.messages) ? body.messages : [],
        stream: true,
        temperature: body.temperature ?? 0.45,
        top_p: body.top_p ?? 0.9,
        max_tokens: Math.min(Number(body.max_tokens || 12000), 12000)
      })
    });

    if (!response.ok || !response.body) {
      const error = await response.text();
      res.status(response.status).send(error || 'Groq request failed');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Unexpected server error' });
    else res.end();
  }
}
