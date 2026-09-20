const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export default function handler(req, res) {
  const ok = Boolean(process.env.DEEPSEEK_API_KEY);
  res.status(ok ? 200 : 500).json({
    ok,
    model: MODEL,
    provider: 'deepseek'
  });
}
