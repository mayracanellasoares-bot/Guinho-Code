import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import handler, { getProviders } from './chat.js';

class ResponseRecorder extends EventEmitter {
  chunks = [];
  headers = {};
  writableEnded = false;
  destroyed = false;
  setHeader(name, value) { this.headers[name] = value; }
  writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); }
  write(chunk) { this.chunks.push(chunk); }
  end() { this.writableEnded = true; }
  json(value) { this.body = value; }
  status(code) { this.status = code; return this; }
}

test('stream interruption emits parseable SSE error and completion frames', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalOrder = process.env.GUINHO_PROVIDER_ORDER;
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.GUINHO_PROVIDER_ORDER = 'openrouter';
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('upstream disconnected')); }
  }), { status: 200 });
  const response = new ResponseRecorder();
  try {
    await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'ping' }] } }, response);
    assert.equal(response.status, 200);
    const frames = response.chunks.join('').split('\n\n').filter(Boolean);
    assert.equal(JSON.parse(frames[0].slice(6)).error.code, 'UPSTREAM_STREAM_FAILED');
    assert.equal(frames[1], 'data: [DONE]');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalOrder === undefined) delete process.env.GUINHO_PROVIDER_ORDER;
    else process.env.GUINHO_PROVIDER_ORDER = originalOrder;
  }
});

test('providers gratuitos ficam na ordem de failover e o ZeroGPU permanece por último', () => {
  const names = ['GROQ_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'GUINHO_ZEROGPU_URL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.GROQ_API_KEY = 'groq-test';
    process.env.OPENROUTER_API_KEY = 'openrouter-test';
    process.env.NVIDIA_API_KEY = 'nvidia-test';
    process.env.GUINHO_ZEROGPU_URL = 'https://guinho-coder.hf.space/';
    assert.deepEqual(getProviders().map(provider => provider.id), [
      'groq-1', 'openrouter-1', 'nvidia-1', 'zerogpu-1'
    ]);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('limita contexto e saída para proteger provedores gratuitos', async () => {
  const previous = {
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
  };
  const originalFetch = globalThis.fetch;
  const calls = [];
  process.env.GROQ_API_KEY = 'groq-test';
  process.env.OPENROUTER_API_KEY = 'openrouter-test';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, payload: JSON.parse(options.body) });
    return new Response(
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    );
  };
  const messages = [
    { role: 'system', content: 'system prompt' },
    ...Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'message ' + index }))
  ];
  const response = new ResponseRecorder();
  try {
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': 'test-limit-context' },
      body: { messages, max_tokens: 99999 }
    }, response);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(calls[0].payload.max_tokens, 8192);
    assert.equal(calls[0].payload.messages.length, 14);
    assert.equal(calls[0].payload.messages[0].role, 'system');
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous.groq;
    if (previous.openrouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous.openrouter;
  }
});

test('aplica limite de requisições por endereço antes de chamar provedores', async () => {
  const previous = process.env.GUINHO_RATE_LIMIT_MAX;
  process.env.GUINHO_RATE_LIMIT_MAX = '1';
  const headers = { 'x-forwarded-for': 'test-rate-limit' };
  try {
    const first = new ResponseRecorder();
    await handler({ method: 'POST', headers, body: {} }, first);
    assert.equal(first.status, 400);

    const second = new ResponseRecorder();
    await handler({ method: 'POST', headers, body: {} }, second);
    assert.equal(second.status, 429);
    assert.equal(second.body.retryable, true);
    assert.ok(Number(second.headers['Retry-After']) >= 1);
  } finally {
    if (previous === undefined) delete process.env.GUINHO_RATE_LIMIT_MAX;
    else process.env.GUINHO_RATE_LIMIT_MAX = previous;
  }
});
