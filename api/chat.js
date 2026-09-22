const MAX_OUTPUT_TOKENS = 32000;
const CONNECT_TIMEOUT_MS = 18000;
const STREAM_IDLE_TIMEOUT_MS = 90000;
const providerCooldownUntil = new Map();

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function keyVariants(names) {
  const values = [];
  for (const name of names) {
    values.push(process.env[name]);
    values.push(process.env[name + '_2']);
    values.push(process.env[name + '_3']);
  }
  return unique(values);
}

function addFamily(providers, config) {
  const keys = keyVariants(config.keyNames);
  keys.forEach((key, index) => {
    const suffix = index ? '_' + (index + 1) : '';
    const model = process.env[config.modelEnv + suffix] || process.env[config.modelEnv] || config.defaultModel;
    providers.push({
      id: config.id + '-' + (index + 1),
      name: config.name,
      key,
      endpoint: config.endpoint,
      model,
      headers: config.headers || {}
    });
  });
}

function getProviders() {
  const providers = [];
  addFamily(providers, {
    id: 'openrouter',
    name: 'OpenRouter',
    keyNames: ['OPENROUTER_API_KEY'],
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'openrouter/free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'HTTP-Referer': 'https://guinho-code.vercel.app',
      'X-Title': 'Guinho Servidor'
    }
  });
  addFamily(providers, {
    id: 'nvidia',
    name: 'NVIDIA',
    keyNames: ['NVIDIA_API_KEY', 'NVIDIA_KEY'],
    modelEnv: 'NVIDIA_MODEL',
    defaultModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions'
  });
  addFamily(providers, {
    id: 'groq',
    name: 'Groq',
    keyNames: ['GROQ_API_KEY'],
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  });
  addFamily(providers, {
    id: 'deepseek',
    name: 'DeepSeek',
    keyNames: ['DEEPSEEK_API_KEY'],
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions'
  });
  addFamily(providers, {
    id: 'gemini',
    name: 'Gemini',
    keyNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  });
  return providers;
}

function getHeaders(provider) {
  return Object.assign({
    Authorization: 'Bearer ' + provider.key,
    'Content-Type': 'application/json'
  }, provider.headers);
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, minimum), maximum);
}

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(message => message && ['system', 'user', 'assistant', 'tool'].includes(message.role) && typeof message.content === 'string')
    .map(message => ({ role: message.role, content: message.content.slice(0, 300000) }))
    .slice(-30);
}

function markFailure(provider, status) {
  const duration = status === 401 || status === 402 ? 300000 : status === 429 ? 60000 : status >= 500 || !status ? 30000 : 120000;
  providerCooldownUntil.set(provider.id, Date.now() + duration);
}

function isCoolingDown(provider) {
  return (providerCooldownUntil.get(provider.id) || 0) > Date.now();
}

function makeCandidates(providers, avoid) {
  const allowed = providers.filter(provider => !avoid.has(provider.id));
  const active = allowed.filter(provider => !isCoolingDown(provider));
  return active.length ? active : allowed;
}

async function openProvider(provider, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: getHeaders(provider),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return { response, controller };
  } finally {
    clearTimeout(timer);
  }
}

function readWithTimeout(reader, controller) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new Error('UPSTREAM_IDLE_TIMEOUT'));
    }, STREAM_IDLE_TIMEOUT_MS);
    reader.read().then(value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }).catch(error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function publicFailures(failures) {
  return failures.map(failure => ({
    provider: failure.provider,
    status: failure.status || 502,
    reason: failure.reason || 'upstream_unavailable'
  }));
}

function stripReasoningFields(value) {
  if (Array.isArray(value)) return value.map(stripReasoningFields);
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set(['reasoning', 'reasoning_content', 'reasoning_details', 'thoughts', 'chain_of_thought']);
  const cleaned = {};
  for (const [key, item] of Object.entries(value)) {
    if (blocked.has(key)) continue;
    cleaned[key] = stripReasoningFields(item);
  }
  return cleaned;
}

function sanitizeSsePayload(payload) {
  if (payload === '[DONE]') return payload;
  try {
    return JSON.stringify(stripReasoningFields(JSON.parse(payload)));
  } catch {
    return payload;
  }
}

function sanitizeSseFrame(frame) {
  return frame.split('\n').map(row => {
    if (!row.startsWith('data: ')) return row;
    return 'data: ' + sanitizeSsePayload(row.slice(6));
  }).join('\n');
}

function flushSseFrames(buffer, writeFrame) {
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let index;
  while ((index = buffer.indexOf('\n\n')) !== -1) {
    const frame = buffer.slice(0, index);
    buffer = buffer.slice(index + 2);
    writeFrame(sanitizeSseFrame(frame) + '\n\n');
  }
  return buffer;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const messages = normalizeMessages(body.messages);
  if (!messages.length) {
    res.status(400).json({ error: 'At least one valid message is required' });
    return;
  }

  const serializedMessages = JSON.stringify(messages);
  if (serializedMessages.length > 1200000) {
    res.status(413).json({ error: 'Conversation payload is too large' });
    return;
  }

  const providers = getProviders();
  if (!providers.length) {
    res.status(503).json({ error: 'No AI provider is configured', retryable: false });
    return;
  }

  const avoid = new Set(Array.isArray(body.avoidProviders) ? body.avoidProviders.filter(value => typeof value === 'string').slice(0, 10) : []);
  const candidates = makeCandidates(providers, avoid);
  const maxTokens = boundedNumber(body.max_tokens, 16000, 256, MAX_OUTPUT_TOKENS);
  const payloadBase = {
    messages,
    stream: true,
    temperature: boundedNumber(body.temperature, 0.55, 0, 2),
    top_p: boundedNumber(body.top_p, 0.9, 0, 1),
    max_tokens: maxTokens
  };
  const failures = [];
  let selected = null;
  let upstream = null;
  let upstreamController = null;

  for (const provider of candidates) {
    const payload = Object.assign({}, payloadBase, { model: provider.model });
    if (provider.name === 'OpenRouter') payload.reasoning = { exclude: true };
    try {
      const opened = await openProvider(provider, payload);
      if (opened.response.ok && opened.response.body) {
        selected = provider;
        upstream = opened.response;
        upstreamController = opened.controller;
        break;
      }
      failures.push({ provider: provider.id, status: opened.response.status, reason: 'http_error' });
      markFailure(provider, opened.response.status);
      try { await opened.response.body?.cancel(); } catch {}
      console.warn('[guinho/chat] provider_failed', { provider: provider.id, status: opened.response.status });
    } catch (error) {
      failures.push({ provider: provider.id, status: 504, reason: error.name === 'AbortError' ? 'connect_timeout' : 'network_error' });
      markFailure(provider);
      console.warn('[guinho/chat] provider_failed', { provider: provider.id, reason: error.name || 'network_error' });
    }
  }

  if (!selected || !upstream || !upstreamController) {
    res.status(503).json({
      error: 'All AI providers are temporarily unavailable',
      retryable: true,
      providers: publicFailures(failures)
    });
    return;
  }

  console.info('[guinho/chat] provider_selected', {
    provider: selected.id,
    candidates: candidates.length,
    failedBeforeSelection: failures.length,
    messageCount: messages.length,
    maxTokens
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Guinho-Provider': selected.id,
    'Access-Control-Expose-Headers': 'X-Guinho-Provider'
  });

  const closeUpstream = () => {
    if (!res.writableEnded && !res.destroyed) upstreamController.abort();
  };
  res.on('close', closeUpstream);

  try {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let upstreamBytes = 0;
    let remainder = '';
    while (true) {
      const result = await readWithTimeout(reader, upstreamController);
      if (result.done) break;
      if (result.value && result.value.byteLength) {
        upstreamBytes += result.value.byteLength;
        remainder = flushSseFrames(remainder + decoder.decode(result.value, { stream: true }), frame => {
          if (!res.destroyed) res.write(frame);
        });
      }
    }
    remainder = flushSseFrames(remainder + decoder.decode(), frame => {
      if (!res.destroyed) res.write(frame);
    });
    if (remainder.trim() && !res.destroyed) {
      res.write(sanitizeSseFrame(remainder) + '\n\n');
    }
    if (!upstreamBytes) throw new Error('UPSTREAM_EMPTY_STREAM');
    if (!res.writableEnded) res.end();
  } catch (error) {
    markFailure(selected);
    console.error('[guinho/chat] stream_failed', {
      provider: selected.id,
      reason: error.name || error.message || 'stream_error'
    });
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.write('data: ' + JSON.stringify({
          error: {
            code: 'UPSTREAM_STREAM_FAILED',
            message: 'The selected provider interrupted the stream',
            retryable: true
          },
          provider: selected.id
        }) + '\\n\\n');
        res.write('data: [DONE]\\n\\n');
      } catch {}
      res.end();
    }
  } finally {
    res.off('close', closeUpstream);
  }
}
