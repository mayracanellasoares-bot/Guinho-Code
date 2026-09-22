import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false
  }
};

function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function summarizeEvent(event, payload) {
  if (event === 'ping') {
    return {
      action: 'ping',
      summary: 'Webhook conectado ao Guinho-Code.',
      repository: payload?.repository?.full_name || null
    };
  }

  if (event === 'issues') {
    return {
      action: payload?.action || 'issue',
      summary: 'Issue recebida: ' + (payload?.issue?.title || 'sem titulo'),
      repository: payload?.repository?.full_name || null,
      url: payload?.issue?.html_url || null
    };
  }

  if (event === 'pull_request') {
    return {
      action: payload?.action || 'pull_request',
      summary: 'Pull request recebido: ' + (payload?.pull_request?.title || 'sem titulo'),
      repository: payload?.repository?.full_name || null,
      url: payload?.pull_request?.html_url || null
    };
  }

  if (event === 'push') {
    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    return {
      action: 'push',
      summary: 'Push recebido com ' + commits.length + ' commit(s).',
      repository: payload?.repository?.full_name || null,
      branch: String(payload?.ref || '').replace('refs/heads/', ''),
      commits: commits.slice(-5).map(commit => ({
        id: commit.id,
        message: commit.message,
        url: commit.url
      }))
    };
  }

  if (event === 'workflow_run') {
    return {
      action: payload?.action || 'workflow_run',
      summary: 'Workflow ' + (payload?.workflow_run?.conclusion || payload?.workflow_run?.status || 'recebido') + ': ' + (payload?.workflow_run?.name || 'sem nome'),
      repository: payload?.repository?.full_name || null,
      url: payload?.workflow_run?.html_url || null
    };
  }

  return {
    action: payload?.action || event || 'unknown',
    summary: 'Evento GitHub recebido: ' + (event || 'unknown'),
    repository: payload?.repository?.full_name || null
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    send(res, 200, {
      ok: true,
      route: '/api/github/webhook',
      configured: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
      message: 'Configure este endpoint como webhook do GitHub e defina GITHUB_WEBHOOK_SECRET na Vercel.'
    });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    send(res, 501, {
      ok: false,
      error: 'GITHUB_WEBHOOK_SECRET nao configurado. O webhook nao aceita eventos sem verificacao.'
    });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-hub-signature-256'];
  if (!verifySignature(rawBody, signature, secret)) {
    send(res, 401, { ok: false, error: 'Invalid GitHub signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    send(res, 400, { ok: false, error: 'Invalid JSON payload' });
    return;
  }

  const event = req.headers['x-github-event'] || 'unknown';
  const delivery = req.headers['x-github-delivery'] || null;
  const summary = summarizeEvent(event, payload);
  const result = {
    ok: true,
    event,
    delivery,
    receivedAt: new Date().toISOString(),
    ...summary
  };

  console.info('[guinho/github/webhook]', result);
  send(res, 200, result);
}
