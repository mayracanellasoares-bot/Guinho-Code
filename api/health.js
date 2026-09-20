const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

export default function handler(req, res) {
  const ok = Boolean(process.env.GROQ_API_KEY);
  res.status(ok ? 200 : 500).json({
    ok,
    model: MODEL,
    provider: 'groq'
  });
}
