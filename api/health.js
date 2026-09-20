const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

export default function handler(req, res) {
  const ok = Boolean(process.env.OPENROUTER_API_KEY);
  res.status(ok ? 200 : 500).json({
    ok,
    model: MODEL,
    provider: 'openrouter'
  });
}
