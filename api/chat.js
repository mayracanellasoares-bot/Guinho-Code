const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'z-ai/glm-5.3-flash';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!nvidiaKey && !openRouterKey) {
    res.status(500).json({ error: 'Missing NVIDIA_API_KEY or OPENROUTER_API_KEY' });
    return;
  }

  const body = req.body || {};
  const payload = {
    model: nvidiaKey ? NVIDIA_MODEL : OPENROUTER_MODEL,
    messages: Array.isArray(body.messages) ? body.messages : [],
    stream: true,
    temperature: body.temperature ?? 0.45,
    top_p: body.top_p ?? 0.9,
    max_tokens: Math.min(Number(body.max_tokens || 32000), 32000)
  };

  const endpoint = nvidiaKey
    ? 'https://integrate.api.nvidia.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';
  const key = nvidiaKey || openRouterKey;
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  if (!nvidiaKey) {
    headers['HTTP-Referer'] = 'https://guinho-code.vercel.app';
    headers['X-Title'] = 'Guinho Servidor';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      const error = await response.text();
      res.status(response.status).json({
        error: nvidiaKey ? 'NVIDIA request failed' : 'OpenRouter request failed',
        details: error.slice(0, 1000)
      });
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
