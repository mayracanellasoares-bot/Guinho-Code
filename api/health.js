import { getProviders } from './chat.js';

export default function handler(req, res) {
  const providers = getProviders().map(({ id, name, model, type }) => ({
    id,
    name,
    model,
    ...(type ? { type } : {})
  }));
  const zeroGpuConfigured = providers.some(provider => provider.type === 'zerogpu');
  const primary = providers[0];
  const ok = providers.length > 0;
  res.setHeader('Cache-Control', 'no-store');
  res.status(ok ? 200 : 500).json({
    ok,
    mode: 'free-failover',
    provider: primary?.name || 'none',
    model: primary?.model || null,
    providers: providers.map(({ id, name, model }) => ({ id, name, model })),
    failoverReady: providers.length > 1,
    zeroGpuConfigured,
    limits: {
      firstContentSeconds: 9,
      streamIdleSeconds: 20,
      defaultOutputTokens: 2048,
      maxOutputTokens: 8192
    }
  });
}
