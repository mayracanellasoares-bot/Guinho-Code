const nvidia = Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY);
const openRouter = Boolean(process.env.OPENROUTER_API_KEY);

export default function handler(req, res) {
  const provider = nvidia ? 'nvidia' : openRouter ? 'openrouter' : 'none';
  const model = nvidia
    ? (process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash')
    : (process.env.OPENROUTER_MODEL || 'openrouter/free');
  const ok = provider !== 'none';
  res.status(ok ? 200 : 500).json({ ok, provider, model });
}
