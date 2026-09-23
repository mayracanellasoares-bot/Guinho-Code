import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import handler from './chat.js';

test('stream interruption emits parseable SSE error and completion frames', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('upstream disconnected')); }
  }), { status: 200 });
  class ResponseRecorder extends EventEmitter {
    chunks = [];
    writableEnded = false;
    destroyed = false;
    writeHead(status, headers) { this.status = status; this.headers = headers; }
    write(chunk) { this.chunks.push(chunk); }
    end() { this.writableEnded = true; }
  }
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
  }
});
