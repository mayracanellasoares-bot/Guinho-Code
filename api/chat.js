import { openZeroGpu, zeroGpuBaseUrl } from './zerogpu.js';

const MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_OUTPUT_TOKENS = 2048;
const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 24000;
const MAX_SERIALIZED_MESSAGES_CHARS = 450000;
const CONNECT_TIMEOUT_MS = 6500;
const STREAM_IDLE_TIMEOUT_MS = 20000;
const FIRST_CONTENT_TIMEOUT_MS = 9000;
const MAX_FRAMES_WITHOUT_CONTENT = 40;
const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 20;
const providerCooldownUntil = new Map();
const rateLimitState = new Map();

const DEFAULT_PROVIDER_ORDER = ['groq', 'openrouter', 'nvidia', 'deepseek', 'gemini'];

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

function providerOrder() {
  const configured = String(process.env.GUINHO_PROVIDER_ORDER || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return unique([...configured, ...DEFAULT_PROVIDER_ORDER]);
}

function orderProviders(providers) {
  const order = providerOrder();
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...providers].sort((left, right) => {
    if (left.type === 'zerogpu' && right.type !== 'zerogpu') return 1;
    if (right.type === 'zerogpu' && left.type !== 'zerogpu') return -1;
    const leftFamily = left.id.split('-')[0];
    const rightFamily = right.id.split('-')[0];
    const leftRank = rank.has(leftFamily) ? rank.get(leftFamily) : order.length + 1;
    const rightRank = rank.has(rightFamily) ? rank.get(rightFamily) : order.length + 1;
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
}

export function getProviders() {
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
  const zeroGpuUrl = zeroGpuBaseUrl(process.env.GUINHO_ZEROGPU_URL);
  if (zeroGpuUrl) providers.push({
    id: 'zerogpu-1', name: 'Hugging Face ZeroGPU',
    endpoint: zeroGpuUrl, key: process.env.GUINHO_ZEROGPU_TOKEN || '',
    model: 'Qwen/Qwen2.5-Coder-1.5B-Instruct', type: 'zerogpu'
  });
  return orderProviders(providers);
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

function clientAddress(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  const real = req.headers?.['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  return 'unknown';
}

function takeRateLimit(req) {
  const now = Date.now();
  const max = Math.max(1, Math.floor(boundedNumber(
    process.env.GUINHO_RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX,
    1,
    120
  )));
  const key = clientAddress(req);
  let entry = rateLimitState.get(key);
  if (!entry || now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) {
    entry = { startedAt: now, count: 0 };
  }
  const allowed = entry.count < max;
  if (allowed) entry.count += 1;
  rateLimitState.set(key, entry);

  if (rateLimitState.size > 1000) {
    for (const [address, value] of rateLimitState) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimitState.delete(address);
    }
  }

  return {
    allowed,
    limit: max,
    remaining: Math.max(0, max - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.startedAt + RATE_LIMIT_WINDOW_MS - now) / 1000))
  };
}

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter(message => message && ['system', 'user', 'assistant', 'tool'].includes(message.role) && typeof message.content === 'string')
    .map(message => ({ role: message.role, content: message.content.slice(0, MAX_MESSAGE_CHARS) }));
  const system = normalized.find(message => message.role === 'system');
  const conversation = normalized.filter(message => message.role !== 'system').slice(-(MAX_MESSAGES - (system ? 1 : 0)));
  return system ? [system, ...conversation] : conversation;
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
  if (provider.type === 'zerogpu') return openZeroGpu(provider, payload);
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

function readWithTimeout(reader, controller, timeoutMs = STREAM_IDLE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new Error('UPSTREAM_IDLE_TIMEOUT'));
    }, timeoutMs);
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

function inspectSsePayload(payload) {
  if (payload === '[DONE]') return { hasData: true, done: true, hasContent: false, hasError: false };
  try {
    const data = JSON.parse(payload);
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const hasContent = choices.some(choice => {
      const delta = choice?.delta || {};
      const message = choice?.message || {};
      return Boolean(
        (typeof delta.content === 'string' && delta.content.length) ||
        (typeof message.content === 'string' && message.content.length)
      );
    });
    return { hasData: true, done: false, hasContent, hasError: Boolean(data.error) };
  } catch {
    return { hasData: true, done: false, hasContent: false, hasError: false };
  }
}

function inspectSseFrame(frame) {
  return frame.split('\n').reduce((stats, row) => {
    if (!row.startsWith('data: ')) return stats;
    const item = inspectSsePayload(row.slice(6));
    return {
      hasData: stats.hasData || item.hasData,
      done: stats.done || item.done,
      hasContent: stats.hasContent || item.hasContent,
      hasError: stats.hasError || item.hasError
    };
  }, { hasData: false, done: false, hasContent: false, hasError: false });
}

function flushSseFrames(buffer, writeFrame, inspectFrame = () => {}) {
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let index;
  while ((index = buffer.indexOf('\n\n')) !== -1) {
    const frame = buffer.slice(0, index);
    buffer = buffer.slice(index + 2);
    inspectFrame(inspectSseFrame(frame));
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

  const limit = takeRateLimit(req);
  res.setHeader('X-RateLimit-Limit', String(limit.limit));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({
      error: 'Muitas solicitações. Aguarde alguns segundos e tente novamente.',
      retryable: true,
      retryAfter: limit.retryAfter
    });
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'JSON inválido' });
      return;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Corpo da requisição inválido' });
    return;
  }
  const messages = normalizeMessages(body.messages);
  if (!messages.length) {
    res.status(400).json({ error: 'At least one valid message is required' });
    return;
  }

  const serializedMessages = JSON.stringify(messages);
  if (serializedMessages.length > MAX_SERIALIZED_MESSAGES_CHARS) {
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
  const maxTokens = boundedNumber(body.max_tokens, DEFAULT_OUTPUT_TOKENS, 256, MAX_OUTPUT_TOKENS);
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
    let sawContent = false;
    let framesWithoutContent = 0;
    const streamStartedAt = Date.now();
    const inspectFrame = stats => {
      if (!stats.hasData || stats.done || stats.hasError) return;
      if (stats.hasContent) {
        sawContent = true;
        framesWithoutContent = 0;
        return;
      }
      if (!sawContent) framesWithoutContent += 1;
    };
    while (true) {
      const firstContentRemaining = FIRST_CONTENT_TIMEOUT_MS - (Date.now() - streamStartedAt);
      if (!sawContent && firstContentRemaining <= 0) throw new Error('UPSTREAM_FIRST_CONTENT_TIMEOUT');
      const result = await readWithTimeout(reader, upstreamController,
        sawContent ? STREAM_IDLE_TIMEOUT_MS : Math.min(STREAM_IDLE_TIMEOUT_MS, firstContentRemaining));
      if (result.done) break;
      if (result.value && result.value.byteLength) {
        upstreamBytes += result.value.byteLength;
        remainder = flushSseFrames(remainder + decoder.decode(result.value, { stream: true }), frame => {
          if (!res.destroyed) res.write(frame);
        }, inspectFrame);
        if (!sawContent && (Date.now() - streamStartedAt > FIRST_CONTENT_TIMEOUT_MS || framesWithoutContent > MAX_FRAMES_WITHOUT_CONTENT)) {
          throw new Error('UPSTREAM_FIRST_CONTENT_TIMEOUT');
        }
      }
    }
    remainder = flushSseFrames(remainder + decoder.decode(), frame => {
      if (!res.destroyed) res.write(frame);
    }, inspectFrame);
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
        }) + '\n\n');
        res.write('data: [DONE]\n\n');
      } catch {}
      res.end();
    }
  } finally {
    res.off('close', closeUpstream);
  }
}
