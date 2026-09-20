const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export default function handler(req, res) {
  const ok = Boolean(process.env.GEMINI_API_KEY);
  res.status(ok ? 200 : 500).json({
    ok,
    model: MODEL,
    provider: 'google-gemini'
  });
}
