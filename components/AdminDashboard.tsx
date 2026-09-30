'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconAlert,
  IconBack,
  IconBolt,
  IconCheck,
  IconDatabase,
  IconKey,
  IconPlay,
  IconRefresh,
  IconTrash,
} from './Icons';
import type { ApiKeyInfo, HealthInfo } from '@/lib/types';

type TestState = { state: 'testing' } | { state: 'ok'; count: number } | { state: 'bad'; error: string };

export default function AdminDashboard() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [label, setLabel] = useState('');
  const [keyText, setKeyText] = useState('');
  const [adding, setAdding] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [kr, hr] = await Promise.all([
        fetch('/api/keys', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }),
      ]);
      const kj = await kr.json();
      if (Array.isArray(kj.keys)) setKeys(kj.keys);
      const hj = await hr.json();
      if (hj && typeof hj === 'object' && 'db' in hj) setHealth(hj as HealthInfo);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const addKeys = async () => {
    const lines = keyText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showToast('Paste at least one API key first.', 'err');
      return;
    }
    setAdding(true);
    try {
      const r = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyText, label }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to add keys');
      showToast(
        `Added ${j.added} key${j.added === 1 ? '' : 's'}${j.skipped ? ` · ${j.skipped} duplicate(s) skipped` : ''}`
      );
      setKeyText('');
      setLabel('');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add keys', 'err');
    } finally {
      setAdding(false);
    }
  };

  const toggleKey = async (k: ApiKeyInfo) => {
    try {
      await fetch(`/api/keys/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !k.enabled }),
      });
      await load();
    } catch {
      showToast('Could not update the key.', 'err');
    }
  };

  const testKey = async (k: ApiKeyInfo) => {
    setTests((t) => ({ ...t, [k.id]: { state: 'testing' } }));
    try {
      const r = await fetch('/api/keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: k.id }),
      });
      const j = await r.json();
      if (j.ok) {
        setTests((t) => ({ ...t, [k.id]: { state: 'ok', count: j.count } }));
      } else {
        setTests((t) => ({ ...t, [k.id]: { state: 'bad', error: j.error || 'Test failed' } }));
      }
    } catch {
      setTests((t) => ({ ...t, [k.id]: { state: 'bad', error: 'Network error' } }));
    }
  };

  const deleteKey = async (id: string) => {
    if (confirmId === id) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmId(null);
      try {
        await fetch(`/api/keys/${id}`, { method: 'DELETE' });
        showToast('Key deleted.');
        await load();
      } catch {
        showToast('Could not delete the key.', 'err');
      }
    } else {
      setConfirmId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmId(null), 2600);
    }
  };

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <Link className="back-btn" href="/">
          <IconBack size={14} /> Back to chat
        </Link>
        <div>
          <div className="admin-title">Admin · API Keys</div>
          <div className="admin-sub">Manage the NVIDIA NIM keys this app uses for every chat.</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">
            {health ? health.keys.enabled : '–'}
            <span className="stat-unit"> / {health ? health.keys.total : '–'} active</span>
          </div>
          <div className="stat-label">API keys</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health ? health.chats : '–'}</div>
          <div className="stat-label">Chats saved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health ? health.messages : '–'}</div>
          <div className="stat-label">Messages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {health ? health.models.count : '–'}
            <span className="stat-unit"> {health ? (health.models.source === 'live' ? 'live' : 'curated') : ''}</span>
          </div>
          <div className="stat-label">Models available</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="card">
          <h2>Add NVIDIA API keys</h2>
          <p className="card-sub">
            Paste one key per line to add as many as you like — requests automatically rotate across all
            active keys (least-recently-used first). Rejected keys are disabled automatically.
          </p>
          <div className="field">
            <label htmlFor="key-label">Label (optional)</label>
            <input
              id="key-label"
              className="input"
              placeholder="e.g. personal, team-pool, free-tier-2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="field">
            <label htmlFor="key-text">API key(s)</label>
            <textarea
              id="key-text"
              className="textarea"
              placeholder={'nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nnvapi-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'}
              value={keyText}
              onChange={(e) => setKeyText(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn" onClick={addKeys} disabled={adding}>
              {adding ? 'Adding…' : 'Add keys'}
            </button>
            <span className="hint">
              Keys start with <code>nvapi-</code> · stored in your database, never shown in full again
            </span>
          </div>
        </div>

        <div className="card">
          <h2>Get a free API key</h2>
          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>
              <span>
                Go to <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer">build.nvidia.com</a> and
                sign in (free account).
              </span>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <span>
                Pick any model and click <strong>“Get API Key”</strong> — you get free credits to start.
              </span>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <span>Copy the <code>nvapi-…</code> key and paste it on the left. That&apos;s it!</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Configured keys
          <button className="sm-btn" onClick={load} title="Refresh">
            <IconRefresh size={12} /> Refresh
          </button>
        </h2>
        <p className="card-sub">Keys are masked after saving. Rotate, test, disable or remove them below.</p>
        {keys.length === 0 ? (
          <div className="empty-note">No API keys yet — add your first one above ☝️</div>
        ) : (
          <div className="keys-scroll">
            <table className="keys-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Used</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const t = tests[k.id];
                  return (
                    <tr key={k.id}>
                      <td>
                        <div className="key-label">{k.label || 'Untitled key'}</div>
                        <div className="key-masked">{k.masked}</div>
                        {k.last_error && <div className="key-error">⚠ {k.last_error}</div>}
                        {t?.state === 'ok' && (
                          <div className="key-test ok">✓ works — {t.count} models accessible</div>
                        )}
                        {t?.state === 'bad' && <div className="key-test bad">✗ {t.error}</div>}
                        {t?.state === 'testing' && <div className="key-test">testing…</div>}
                      </td>
                      <td>
                        <span className={`status-pill ${k.enabled ? 'on' : 'off'}`}>
                          <span className="status-dot" />
                          {k.enabled ? 'Active' : 'Disabled'}
                        </span>
                        {k.fail_count > 0 && (
                          <div className="key-error" style={{ marginTop: 4 }}>
                            {k.fail_count} recent failure{k.fail_count === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="sm-btn" onClick={() => testKey(k)} disabled={t?.state === 'testing'}>
                            <IconPlay size={11} /> Test
                          </button>
                          <button className="sm-btn" onClick={() => toggleKey(k)}>
                            {k.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className={`sm-btn danger ${confirmId === k.id ? 'confirm' : ''}`}
                            onClick={() => deleteKey(k.id)}
                          >
                            {confirmId === k.id ? (
                              'Confirm?'
                            ) : (
                              <>
                                <IconTrash size={11} /> Delete
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconDatabase size={16} /> Database
        </h2>
        {health?.db === 'postgres' ? (
          <div className="db-connected">
            <IconCheck size={16} /> Connected — chats, messages and API keys are persisted in Postgres.
          </div>
        ) : (
          <>
            <p className="card-sub">
              Running in <strong>demo mode</strong> (in-memory). To save chats permanently on Vercel, connect a free
              Neon Postgres database:
            </p>
            <div className="steps">
              <div className="step">
                <span className="step-num">1</span>
                <span>
                  Create a project at <a href="https://neon.tech">neon.tech</a> (or install the Neon integration from
                  the Vercel marketplace).
                </span>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <span>
                  Copy the <strong>pooled</strong> connection string and add it as the{' '}
                  <code>DATABASE_URL</code> environment variable in Vercel → Settings → Environment Variables.
                </span>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <span>Redeploy — tables are created automatically on first use.</span>
              </div>
            </div>
            <div className="mono-box">DATABASE_URL=postgresql://user:pass@ep-xxx-pooler-xxx.neon.tech/neondb?sslmode=require</div>
          </>
        )}
      </div>

      <div className="warn-box">
        <IconAlert size={16} />
        <span>
          <strong>Public admin:</strong> this panel intentionally has no login (anyone with the URL can manage
          keys). That works great for a personal deployment — if you share the URL publicly, remember that anyone can
          add, disable or remove keys.
        </span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 26 }}>
        <Link className="btn secondary" href="/">
          <IconBolt size={14} /> Back to chatting
        </Link>
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
