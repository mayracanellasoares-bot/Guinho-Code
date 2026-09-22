const MAX_MESSAGES = 80;
const MAX_CONTENT_LENGTH = 240000;
const MAX_TITLE_LENGTH = 90;
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;
const CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,96}$/;

let schemaReady = false;
let neonFactoryPromise = null;

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  neonFactoryPromise ||= import('@neondatabase/serverless').then(module => module.neon);
  const neon = await neonFactoryPromise;
  return neon(process.env.DATABASE_URL);
}

function getClientId(req, body) {
  const headerValue = req.headers['x-guinho-client-id'];
  const value = typeof headerValue === 'string' ? headerValue : body?.clientId;
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  return CLIENT_ID_PATTERN.test(cleaned) ? cleaned : '';
}

function cleanConversationId(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  return CONVERSATION_ID_PATTERN.test(cleaned) ? cleaned : '';
}

function cleanTitle(value, messages) {
  const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (title) return title.slice(0, MAX_TITLE_LENGTH);
  const firstUser = messages.find(message => message.role === 'user')?.content || 'Nova conversa';
  return firstUser.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) || 'Nova conversa';
}

function cleanMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(message => ({
      role: message.role,
      content: message.content.slice(0, MAX_CONTENT_LENGTH),
      createdAt: typeof message.createdAt === 'string' ? message.createdAt.slice(0, 40) : new Date().toISOString()
    }));
}

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    create table if not exists guinho_chat_history (
      client_id text not null,
      conversation_id text not null,
      title text not null,
      messages jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (client_id, conversation_id)
    )
  `;
  await sql`
    create index if not exists guinho_chat_history_updated_idx
    on guinho_chat_history (client_id, updated_at desc)
  `;
  schemaReady = true;
}

async function listConversations(sql, clientId) {
  return sql`
    select conversation_id, title, messages, created_at, updated_at
    from guinho_chat_history
    where client_id = ${clientId}
    order by updated_at desc
    limit 30
  `;
}

export default async function handler(req, res) {
  setNoStore(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const body = req.body || {};
  const clientId = getClientId(req, body);
  if (!clientId) {
    res.status(400).json({ ok: false, error: 'Invalid anonymous client id' });
    return;
  }

  const sql = await getSql();
  if (!sql) {
    res.status(200).json({
      ok: true,
      remote: false,
      warning: 'DATABASE_URL is not configured; history remains local in the browser',
      conversations: []
    });
    return;
  }

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const rows = await listConversations(sql, clientId);
      res.status(200).json({
        ok: true,
        remote: true,
        conversations: rows.map(row => ({
          id: row.conversation_id,
          title: row.title,
          messages: Array.isArray(row.messages) ? row.messages : [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
      return;
    }

    const action = typeof body.action === 'string' ? body.action : 'save';

    if (action === 'deleteAll') {
      await sql`delete from guinho_chat_history where client_id = ${clientId}`;
      res.status(200).json({ ok: true, remote: true, deleted: 'all' });
      return;
    }

    if (action === 'delete') {
      const conversationId = cleanConversationId(body.conversationId);
      if (!conversationId) {
        res.status(400).json({ ok: false, error: 'Invalid conversation id' });
        return;
      }
      await sql`
        delete from guinho_chat_history
        where client_id = ${clientId} and conversation_id = ${conversationId}
      `;
      res.status(200).json({ ok: true, remote: true, deleted: conversationId });
      return;
    }

    const conversationId = cleanConversationId(body.conversationId);
    const messages = cleanMessages(body.messages);
    if (!conversationId || !messages.length) {
      res.status(400).json({ ok: false, error: 'Conversation id and messages are required' });
      return;
    }

    const title = cleanTitle(body.title, messages);
    await sql`
      insert into guinho_chat_history (client_id, conversation_id, title, messages, updated_at)
      values (${clientId}, ${conversationId}, ${title}, ${JSON.stringify(messages)}::jsonb, now())
      on conflict (client_id, conversation_id) do update set
        title = excluded.title,
        messages = excluded.messages,
        updated_at = now()
    `;

    res.status(200).json({ ok: true, remote: true, conversationId, title });
  } catch (error) {
    console.error('[guinho/history] failed', { reason: error.message || 'unknown' });
    res.status(500).json({ ok: false, error: 'History storage failed' });
  }
}
