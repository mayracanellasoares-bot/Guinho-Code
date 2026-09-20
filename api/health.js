const MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-coder-32b-instruct';

export default function handler(req, res) {
  res.status(process.env.OPENROUTER_API_KEY ? 200 : 500).json({
    ok: Boolean(process.env.OPENROUTER_API_KEY),
    model: MODEL
  });
}
