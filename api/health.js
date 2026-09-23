import { zeroGpuBaseUrl } from './zerogpu.js';

function family(keys, id, name, modelEnv, fallbackModel) {
  const values = [...new Set(keys.flatMap(key => [
    process.env[key],
    process.env[key + '_2'],
    process.env[key + '_3']
  ].filter(Boolean)))];
  return values.map((_, index) => ({
    id: id + '-' + (index + 1),
    name,
    model: process.env[modelEnv + (index ? '_' + (index + 1) : '')] || process.env[modelEnv] || fallbackModel
  }));
}

export default function handler(req, res) {
  const providers = [
    ...family(['OPENROUTER_API_KEY'], 'openrouter', 'OpenRouter', 'OPENROUTER_MODEL', 'openrouter/free'),
    ...family(['NVIDIA_API_KEY', 'NVIDIA_KEY'], 'nvidia', 'NVIDIA', 'NVIDIA_MODEL', 'nvidia/nemotron-3.5-lightning-30b-a3b'),
    ...family(['GROQ_API_KEY'], 'groq', 'Groq', 'GROQ_MODEL', 'llama-3.3-70b-versatile'),
    ...family(['DEEPSEEK_API_KEY'], 'deepseek', 'DeepSeek', 'DEEPSEEK_MODEL', 'deepseek-chat'),
    ...family(['GEMINI_API_KEY', 'GOOGLE_API_KEY'], 'gemini', 'Gemini', 'GEMINI_MODEL', 'gemini-2.0-flash')
  ];
  const zeroGpuConfigured = Boolean(zeroGpuBaseUrl(process.env.GUINHO_ZEROGPU_URL));
  if (zeroGpuConfigured) providers.push({ id: 'zerogpu-1', name: 'Hugging Face ZeroGPU', model: 'Qwen/Qwen2.5-Coder-1.5B-Instruct' });
  const primary = providers[0];
  const ok = providers.length > 0;
  res.status(ok ? 200 : 500).json({
    ok,
    provider: primary?.name || 'none',
    model: primary?.model || null,
    providers: providers.map(({ id, name, model }) => ({ id, name, model })),
    failoverReady: providers.length > 1,
    zeroGpuConfigured
  });
}
