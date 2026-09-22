const nvidia = Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY);
const openRouter = Boolean(process.env.OPENROUTER_API_KEY);

export default function handler(req, res) {
  const provider = openRouter ? 'openrouter' : nvidia ? 'nvidia' : 'none';
  const model = openRouter
    ? (process.env.OPENROUTER_MODEL || 'openrouter/free')
    : (process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b');
  const ok = provider !== 'none';
  res.status(ok ? 200 : 500).json({ ok, provider, model });
}
