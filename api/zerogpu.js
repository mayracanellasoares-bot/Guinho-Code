const MAX_WAIT_MS = 25000;
const MAX_EVENT_BYTES = 262144;

export function zeroGpuBaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.hf.space') ||
        url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function readOutput(buffer) {
  const event = /^event:\s*(\S+)/m.exec(buffer)?.[1];
  if (event === 'error') throw new Error('ZEROGPU_JOB_ERROR');
  if (event !== 'complete') return null;
  const data = /^data:\s*(.*)$/m.exec(buffer)?.[1];
  if (!data) throw new Error('ZEROGPU_EMPTY_RESULT');
  const value = JSON.parse(data);
  if (!Array.isArray(value) || typeof value[0] !== 'string' || !value[0].trim()) {
    throw new Error('ZEROGPU_EMPTY_RESULT');
  }
  return value[0];
}

async function waitForCompletion(response, controller) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ZEROGPU_NO_STREAM');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    if (buffer.length > MAX_EVENT_BYTES) throw new Error('ZEROGPU_RESULT_TOO_LARGE');
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const answer = readOutput(frame);
      if (answer !== null) {
        controller.abort();
        return answer;
      }
    }
  }
  const answer = readOutput(buffer);
  if (answer !== null) return answer;
  throw new Error('ZEROGPU_JOB_INCOMPLETE');
}

export async function openZeroGpu(provider, payload) {
  const base = zeroGpuBaseUrl(provider.endpoint);
  if (!base) throw new Error('ZEROGPU_INVALID_URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_WAIT_MS);
  const headers = { 'Content-Type': 'application/json' };
  if (provider.key) headers.Authorization = 'Bearer ' + provider.key;
  try {
    const submit = await fetch(base + '/gradio_api/call/generate', {
      method: 'POST', headers, body: JSON.stringify({ data: [JSON.stringify(payload.messages)] }),
      signal: controller.signal
    });
    if (!submit.ok) return { response: submit, controller };
    const job = await submit.json();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(job.event_id || '')) throw new Error('ZEROGPU_INVALID_EVENT');
    const result = await fetch(base + '/gradio_api/call/generate/' + job.event_id, {
      headers, signal: controller.signal
    });
    if (!result.ok) return { response: result, controller };
    const answer = await waitForCompletion(result, controller);
    const sse = 'data: ' + JSON.stringify({
      choices: [{ index: 0, delta: { content: answer }, finish_reason: null }]
    }) + '\n\ndata: [DONE]\n\n';
    return {
      response: new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } }),
      controller: new AbortController()
    };
  } finally {
    clearTimeout(timer);
  }
}
