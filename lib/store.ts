// Storage layer.
//
// - With DATABASE_URL set (Neon Postgres on Vercel) everything is persisted:
//   chats, messages and NVIDIA API keys. Tables are created automatically.
// - Without DATABASE_URL (e.g. local preview) an in-memory store is used so
//   the app still works — the UI shows a "demo mode" badge in that case.

import { Pool } from 'pg';
import crypto from 'crypto';
import type { ChatSummary } from './types';

export function uid(): string {
  return crypto.randomUUID();
}

export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 12) return '••••••';
  const prefix = k.startsWith('nvapi-') ? 'nvapi-' : k.slice(0, 4);
  return `${prefix}••••••${k.slice(-4)}`;
}

export interface StoredChat {
  id: string;
  title: string;
}

export interface StoredMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string | null;
  model: string | null;
  created_at: string;
}

export interface StoredKey {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  fail_count: number;
  last_error: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface StoreStats {
  chats: number;
  messages: number;
  keys: number;
  keysEnabled: number;
}

export interface Store {
  kind: 'postgres' | 'memory';
  listChats(): Promise<ChatSummary[]>;
  getChat(id: string): Promise<StoredChat | null>;
  createChat(title?: string): Promise<StoredChat>;
  renameChat(id: string, title: string): Promise<void>;
  deleteChat(id: string): Promise<void>;
  touchChat(id: string): Promise<void>;
  getMessages(chatId: string): Promise<StoredMessage[]>;
  addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string | null,
    reasoning?: string | null
  ): Promise<StoredMessage>;
  listKeys(): Promise<StoredKey[]>;
  addKeys(entries: { key: string; label: string }[]): Promise<{ added: number; skipped: number }>;
  updateKey(id: string, patch: { enabled?: boolean; label?: string }): Promise<void>;
  markKeyUsed(id: string): Promise<void>;
  recordKeyFailure(id: string, message: string): Promise<void>;
  deleteKey(id: string): Promise<void>;
  stats(): Promise<StoreStats>;
}

// ────────────────────────────── Postgres store ───────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS chats (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  seq        BIGSERIAL NOT NULL,
  chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  reasoning  TEXT,
  model      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_seq ON messages (chat_id, seq);
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT '',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  fail_count   INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
}

class PostgresStore implements Store {
  kind = 'postgres' as const;
  private pool: Pool;
  private schemaPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    let host = '';
    try {
      host = new URL(connectionString).hostname;
    } catch {
      /* fall through with empty host */
    }
    const local = isLocalHost(host);
    this.pool =
      ((globalThis as unknown as { __curiousPgPool?: Pool }).__curiousPgPool ??= new Pool({
        connectionString,
        max: local ? 5 : 1,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 15_000,
        ssl: local ? undefined : { rejectUnauthorized: false },
      }));
  }

  private ready(): Promise<void> {
    this.schemaPromise ??= this.pool.query(SCHEMA_SQL).then(() => undefined);
    return this.schemaPromise;
  }

  async listChats(): Promise<ChatSummary[]> {
    await this.ready();
    const r = await this.pool.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT count(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
       FROM chats c
       ORDER BY c.updated_at DESC
       LIMIT 300`
    );
    return r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      message_count: Number(row.message_count),
    }));
  }

  async getChat(id: string): Promise<StoredChat | null> {
    await this.ready();
    const r = await this.pool.query('SELECT id, title FROM chats WHERE id = $1', [id]);
    return r.rows[0] ? { id: r.rows[0].id, title: r.rows[0].title } : null;
  }

  async createChat(title = 'New Chat'): Promise<StoredChat> {
    await this.ready();
    const id = uid();
    await this.pool.query('INSERT INTO chats (id, title) VALUES ($1, $2)', [id, title]);
    return { id, title };
  }

  async renameChat(id: string, title: string): Promise<void> {
    await this.ready();
    await this.pool.query('UPDATE chats SET title = $2 WHERE id = $1', [id, title]);
  }

  async deleteChat(id: string): Promise<void> {
    await this.ready();
    await this.pool.query('DELETE FROM chats WHERE id = $1', [id]);
  }

  async touchChat(id: string): Promise<void> {
    await this.ready();
    await this.pool.query('UPDATE chats SET updated_at = now() WHERE id = $1', [id]);
  }

  private mapMessage(row: Record<string, unknown>): StoredMessage {
    return {
      id: String(row.id),
      chat_id: String(row.chat_id),
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: String(row.content ?? ''),
      reasoning: (row.reasoning as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      created_at: new Date(row.created_at as string).toISOString(),
    };
  }

  async getMessages(chatId: string): Promise<StoredMessage[]> {
    await this.ready();
    const r = await this.pool.query(
      'SELECT id, chat_id, role, content, reasoning, model, created_at FROM messages WHERE chat_id = $1 ORDER BY seq ASC',
      [chatId]
    );
    return r.rows.map((row) => this.mapMessage(row));
  }

  async addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string | null,
    reasoning?: string | null
  ): Promise<StoredMessage> {
    await this.ready();
    const id = uid();
    const r = await this.pool.query(
      `INSERT INTO messages (id, chat_id, role, content, reasoning, model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, chat_id, role, content, reasoning, model, created_at`,
      [id, chatId, role, content, reasoning ?? null, model ?? null]
    );
    return this.mapMessage(r.rows[0]);
  }

  async listKeys(): Promise<StoredKey[]> {
    await this.ready();
    const r = await this.pool.query(
      'SELECT id, key, label, enabled, fail_count, last_error, last_used_at, created_at FROM api_keys ORDER BY last_used_at ASC NULLS FIRST, created_at ASC'
    );
    return r.rows.map((row) => ({
      id: String(row.id),
      key: String(row.key),
      label: String(row.label ?? ''),
      enabled: Boolean(row.enabled),
      fail_count: Number(row.fail_count ?? 0),
      last_error: (row.last_error as string | null) ?? null,
      last_used_at: row.last_used_at ? new Date(row.last_used_at as string).toISOString() : null,
      created_at: new Date(row.created_at as string).toISOString(),
    }));
  }

  async addKeys(entries: { key: string; label: string }[]): Promise<{ added: number; skipped: number }> {
    await this.ready();
    let added = 0;
    let skipped = 0;
    for (const e of entries) {
      const r = await this.pool.query(
        'INSERT INTO api_keys (id, key, label) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
        [uid(), e.key, e.label]
      );
      if (r.rowCount && r.rowCount > 0) added += 1;
      else skipped += 1;
    }
    return { added, skipped };
  }

  async updateKey(id: string, patch: { enabled?: boolean; label?: string }): Promise<void> {
    await this.ready();
    if (patch.enabled !== undefined) {
      await this.pool.query(
        'UPDATE api_keys SET enabled = $2, fail_count = 0, last_error = NULL WHERE id = $1',
        [id, patch.enabled]
      );
    }
    if (patch.label !== undefined) {
      await this.pool.query('UPDATE api_keys SET label = $2 WHERE id = $1', [id, patch.label]);
    }
  }

  async markKeyUsed(id: string): Promise<void> {
    await this.ready();
    await this.pool.query(
      'UPDATE api_keys SET last_used_at = now(), fail_count = 0, last_error = NULL WHERE id = $1',
      [id]
    );
  }

  async recordKeyFailure(id: string, message: string): Promise<void> {
    await this.ready();
    await this.pool.query(
      'UPDATE api_keys SET fail_count = fail_count + 1, last_error = $2 WHERE id = $1',
      [id, message]
    );
  }

  async deleteKey(id: string): Promise<void> {
    await this.ready();
    await this.pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
  }

  async stats(): Promise<StoreStats> {
    await this.ready();
    const r = await this.pool.query(`
      SELECT
        (SELECT count(*) FROM chats) AS chats,
        (SELECT count(*) FROM messages) AS messages,
        (SELECT count(*) FROM api_keys) AS keys,
        (SELECT count(*) FROM api_keys WHERE enabled) AS keys_enabled
    `);
    const row = r.rows[0];
    return {
      chats: Number(row.chats),
      messages: Number(row.messages),
      keys: Number(row.keys),
      keysEnabled: Number(row.keys_enabled),
    };
  }
}

// ────────────────────────────── In-memory store ──────────────────────────────

interface MemChat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

class MemoryStore implements Store {
  kind = 'memory' as const;
  private chats = new Map<string, MemChat>();
  private messages: StoredMessage[] = [];
  private keys = new Map<string, StoredKey>();
  private seq = 0;

  async listChats(): Promise<ChatSummary[]> {
    const list = [...this.chats.values()].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return list.map((c) => ({
      ...c,
      message_count: this.messages.filter((m) => m.chat_id === c.id).length,
    }));
  }

  async getChat(id: string): Promise<StoredChat | null> {
    const c = this.chats.get(id);
    return c ? { id: c.id, title: c.title } : null;
  }

  async createChat(title = 'New Chat'): Promise<StoredChat> {
    const chat: MemChat = {
      id: uid(),
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.chats.set(chat.id, chat);
    return { id: chat.id, title: chat.title };
  }

  async renameChat(id: string, title: string): Promise<void> {
    const c = this.chats.get(id);
    if (c) c.title = title;
  }

  async deleteChat(id: string): Promise<void> {
    this.chats.delete(id);
    this.messages = this.messages.filter((m) => m.chat_id !== id);
  }

  async touchChat(id: string): Promise<void> {
    const c = this.chats.get(id);
    if (c) c.updated_at = new Date().toISOString();
  }

  async getMessages(chatId: string): Promise<StoredMessage[]> {
    return this.messages.filter((m) => m.chat_id === chatId);
  }

  async addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string | null,
    reasoning?: string | null
  ): Promise<StoredMessage> {
    const msg: StoredMessage = {
      id: uid(),
      chat_id: chatId,
      role,
      content,
      reasoning: reasoning ?? null,
      model: model ?? null,
      created_at: new Date().toISOString(),
    };
    this.messages.push(msg);
    this.seq += 1;
    this.touchChat(chatId);
    return msg;
  }

  async listKeys(): Promise<StoredKey[]> {
    const keys = [...this.keys.values()].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    // least-recently-used first, never-used first of all
    return keys.sort((a, b) => {
      const ta = a.last_used_at ?? '0000';
      const tb = b.last_used_at ?? '0000';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  }

  async addKeys(entries: { key: string; label: string }[]): Promise<{ added: number; skipped: number }> {
    const existing = new Set([...this.keys.values()].map((k) => k.key));
    let added = 0;
    let skipped = 0;
    for (const e of entries) {
      if (existing.has(e.key)) {
        skipped += 1;
        continue;
      }
      const k: StoredKey = {
        id: uid(),
        key: e.key,
        label: e.label,
        enabled: true,
        fail_count: 0,
        last_error: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
      };
      this.keys.set(k.id, k);
      existing.add(e.key);
      added += 1;
    }
    return { added, skipped };
  }

  async updateKey(id: string, patch: { enabled?: boolean; label?: string }): Promise<void> {
    const k = this.keys.get(id);
    if (!k) return;
    if (patch.enabled !== undefined) {
      k.enabled = patch.enabled;
      k.fail_count = 0;
      k.last_error = null;
    }
    if (patch.label !== undefined) k.label = patch.label;
  }

  async markKeyUsed(id: string): Promise<void> {
    const k = this.keys.get(id);
    if (!k) return;
    k.last_used_at = new Date().toISOString();
    k.fail_count = 0;
    k.last_error = null;
  }

  async recordKeyFailure(id: string, message: string): Promise<void> {
    const k = this.keys.get(id);
    if (!k) return;
    k.fail_count += 1;
    k.last_error = message;
  }

  async deleteKey(id: string): Promise<void> {
    this.keys.delete(id);
  }

  async stats(): Promise<StoreStats> {
    let enabled = 0;
    for (const k of this.keys.values()) if (k.enabled) enabled += 1;
    return {
      chats: this.chats.size,
      messages: this.messages.length,
      keys: this.keys.size,
      keysEnabled: enabled,
    };
  }
}

// ────────────────────────────── singleton access ─────────────────────────────

let storeInstance: Store | null = null;

export function getStore(): Store {
  if (!storeInstance) {
    const url = process.env.DATABASE_URL;
    storeInstance = url ? new PostgresStore(url) : new MemoryStore();
  }
  return storeInstance;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
