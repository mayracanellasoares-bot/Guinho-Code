function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function readHealth(req) {
  const origin = getOrigin(req);
  const timeout = timeoutSignal(12000);
  try {
    const response = await fetch(origin + '/api/health', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: timeout.signal
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    timeout.done();
  }
}

function authorizeCron(req) {
  const manual = req.query?.manual === '1';
  if (manual) return { ok: true, mode: 'manual' };

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: 'CRON_SECRET nao configurado. Defina essa variavel na Vercel para ativar o watchdog automatico.'
      }
    };
  }

  if (req.headers.authorization !== 'Bearer ' + secret) {
    return { ok: false, status: 401, body: { ok: false, error: 'Unauthorized' } };
  }

  return { ok: true, mode: 'cron' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const auth = authorizeCron(req);
  if (!auth.ok) {
    send(res, auth.status, auth.body);
    return;
  }

  try {
    const health = await readHealth(req);
    const providers = Array.isArray(health.data?.providers) ? health.data.providers : [];
    const action = health.ok
      ? providers.length > 1
        ? 'Servidor principal online; failover disponivel.'
        : 'Servidor online; configure uma segunda chave/provedor para failover real.'
      : 'Servidor retornou falha; verifique variaveis de ambiente e provedores de IA.';

    const result = {
      ok: health.ok,
      mode: auth.mode,
      checkedAt: new Date().toISOString(),
      healthStatus: health.status,
      provider: health.data?.provider || 'none',
      model: health.data?.model || null,
      providers,
      failoverReady: providers.length > 1,
      action
    };

    console.info('[guinho/watchdog]', result);
    send(res, health.ok ? 200 : 503, result);
  } catch (error) {
    const result = {
      ok: false,
      mode: auth.mode,
      checkedAt: new Date().toISOString(),
      error: error.name === 'AbortError' ? 'Health check timeout' : error.message || 'Health check failed'
    };
    console.error('[guinho/watchdog] failed', result);
    send(res, 503, result);
  }
}
