const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function sseText(text) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    return;
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = messages.find((m) => m.role === 'system');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '') }]
      }));

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

    const payload = {
      contents,
      generationConfig: {
        temperature: body.temperature ?? 0.45,
        topP: body.top_p ?? 0.9,
        maxOutputTokens: Math.min(Number(body.max_tokens || 12000), 12000)
      }
    };
    if (system?.content) {
      payload.systemInstruction = { parts: [{ text: String(system.content) }] };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      const error = await response.text();
      res.status(response.status).send(error || 'Gemini request failed');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const chunk = JSON.parse(raw);
          const text = chunk?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || '').join('');
          if (text) res.write(sseText(text));
        } catch {
          // Ignore incomplete SSE frames; the next frame contains the full JSON.
        }
      }
      if (done) break;
    }

    res.write('data: [DONE]\\n\\n');
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Unexpected server error' });
    else res.end();
  }
}
