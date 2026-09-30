'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import Message from './Message';
import ModelSelect from './ModelSelect';
import Composer from './Composer';
import EmptyState from './EmptyState';
import { IconKey, IconMenu } from './Icons';
import Link from 'next/link';
import type { ChatMessage, ChatSummary, HealthInfo, ModelsResponse } from '@/lib/types';

type Theme = 'dark' | 'light';

function initialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
}

export default function ChatApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamMsg, setStreamMsg] = useState<{ content: string; reasoning: string } | null>(null);
  const [model, setModel] = useState('meta/llama-3.3-70b-instruct');
  const [models, setModels] = useState<string[]>([]);
  const [modelSource, setModelSource] = useState<'live' | 'fallback'>('fallback');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentId;

  const showToast = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  };

  // ── data loading ──────────────────────────────────────────────────────────

  const loadChats = useCallback(async () => {
    try {
      const r = await fetch('/api/chats', { cache: 'no-store' });
      const j = await r.json();
      if (Array.isArray(j.chats)) setChats(j.chats);
    } catch {
      /* offline */
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const j = (await r.json()) as HealthInfo;
      setHealth(j);
    } catch {
      /* offline */
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const r = await fetch('/api/models', { cache: 'no-store' });
      const j = (await r.json()) as ModelsResponse;
      if (Array.isArray(j.models) && j.models.length > 0) {
        setModels(j.models);
        setModelSource(j.source);
        setModel((prev) =>
          j.models.includes(prev) ? prev : (j.default ?? j.models[0])
        );
      }
    } catch {
      /* offline */
    }
  }, []);

  const openChat = useCallback(async (id: string) => {
    setCurrentId(id);
    setStreamMsg(null);
    stickToBottom.current = true;
    try {
      const r = await fetch(`/api/chats/${id}/messages`, { cache: 'no-store' });
      const j = await r.json();
      setMessages(Array.isArray(j.messages) ? j.messages : []);
    } catch {
      setMessages([]);
    }
    window.history.replaceState(null, '', `/?c=${id}`);
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    setTheme(initialTheme());
    loadChats();
    loadHealth();
    loadModels();
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    if (c) openChat(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── theme ─────────────────────────────────────────────────────────────────

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('ca-theme', next);
    } catch {
      /* storage blocked */
    }
  };

  // ── autoscroll ────────────────────────────────────────────────────────────

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, streamMsg]);

  // ── chat actions ──────────────────────────────────────────────────────────

  const newChat = () => {
    if (streaming) abortRef.current?.abort();
    setCurrentId(null);
    setMessages([]);
    setStreamMsg(null);
    setInput('');
    window.history.replaceState(null, '', '/');
    setSidebarOpen(false);
  };

  const selectChat = (id: string) => {
    if (id === currentId) {
      setSidebarOpen(false);
      return;
    }
    if (streaming) abortRef.current?.abort();
    openChat(id);
  };

  const renameChat = async (id: string, title: string) => {
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      const r = await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) throw new Error();
    } catch {
      showToast('Could not rename the chat.', 'err');
      loadChats();
    }
  };

  const deleteChat = async (id: string) => {
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === currentId) {
      setCurrentId(null);
      setMessages([]);
      window.history.replaceState(null, '', '/');
    }
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    } catch {
      showToast('Could not delete the chat.', 'err');
    }
    loadChats();
    loadHealth();
  };

  // ── send message (streaming) ──────────────────────────────────────────────

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setMessages((ms) => [
      ...ms,
      { id: `local-u-${Date.now()}`, role: 'user', content: text },
    ]);
    setStreaming(true);
    stickToBottom.current = true;
    let acc = { content: '', reasoning: '' };
    setStreamMsg({ content: '', reasoning: '' });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const finishWithLocal = () => {
      // keep whatever streamed in (e.g. after pressing Stop)
      if (acc.content.trim() || acc.reasoning.trim()) {
        setMessages((ms) => [
          ...ms,
          {
            id: `local-a-${Date.now()}`,
            role: 'assistant',
            content: acc.content,
            reasoning: acc.reasoning || null,
            model,
          },
        ]);
      }
      setStreamMsg(null);
      setStreaming(false);
      abortRef.current = null;
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: currentIdRef.current, message: text, model }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: `Request failed (HTTP ${res.status})` }));
        setMessages((ms) => [
          ...ms,
          {
            id: `local-e-${Date.now()}`,
            role: 'assistant',
            error: true,
            content: (j.error as string) || 'Something went wrong.',
          },
        ]);
        setStreamMsg(null);
        setStreaming(false);
        abortRef.current = null;
        loadHealth();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;
      let gotMeta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: {
            type: string;
            chatId?: string;
            chatTitle?: string;
            text?: string;
            error?: string;
          };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === 'meta' && ev.chatId) {
            gotMeta = true;
            const isNew = !currentIdRef.current;
            if (isNew) setCurrentId(ev.chatId);
            currentIdRef.current = ev.chatId;
            window.history.replaceState(null, '', `/?c=${ev.chatId}`);
            setChats((cs) => {
              const exists = cs.some((c) => c.id === ev.chatId);
              if (exists) {
                return cs.map((c) =>
                  c.id === ev.chatId ? { ...c, title: ev.chatTitle || c.title } : c
                );
              }
              return [
                {
                  id: ev.chatId!,
                  title: ev.chatTitle || 'New Chat',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  message_count: 1,
                },
                ...cs,
              ];
            });
          } else if (ev.type === 'delta' && ev.text) {
            acc = { ...acc, content: acc.content + ev.text };
            setStreamMsg({ ...acc });
          } else if (ev.type === 'reasoning' && ev.text) {
            acc = { ...acc, reasoning: acc.reasoning + ev.text };
            setStreamMsg({ ...acc });
          } else if (ev.type === 'error' && ev.error) {
            streamError = ev.error;
          } else if (ev.type === 'done') {
            // server persisted the message; show it as a finalized message
            if (acc.content.trim() || acc.reasoning.trim()) {
              setMessages((ms) => [
                ...ms,
                {
                  id: `local-a-${Date.now()}`,
                  role: 'assistant',
                  content: acc.content,
                  reasoning: acc.reasoning || null,
                  model,
                },
              ]);
            }
            if (streamError) {
              const errMsg: string = streamError;
              setMessages((ms) => [
                ...ms,
                {
                  id: `local-e-${Date.now()}`,
                  role: 'assistant',
                  error: true,
                  content: errMsg,
                },
              ]);
            }
            acc = { content: '', reasoning: '' };
            setStreamMsg(null);
          }
        }
      }

      // Stream ended without a done event (e.g. connection drop)
      if (acc.content.trim() || acc.reasoning.trim()) {
        finishWithLocal();
      } else {
        setStreamMsg(null);
        setStreaming(false);
        abortRef.current = null;
      }
      if (gotMeta) {
        loadChats();
        loadHealth();
        loadModels();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        finishWithLocal();
        loadChats();
      } else {
        setMessages((ms) => [
          ...ms,
          {
            id: `local-e-${Date.now()}`,
            role: 'assistant',
            error: true,
            content: e instanceof Error ? e.message : 'Network error — please try again.',
          },
        ]);
        setStreamMsg(null);
        setStreaming(false);
        abortRef.current = null;
      }
    }
  };

  const stop = () => abortRef.current?.abort();

  // ── render ────────────────────────────────────────────────────────────────

  const dbLabel =
    health?.db === 'postgres' ? 'history saved to Postgres' : 'demo mode — connect Neon to save history';
  const currentChat = chats.find((c) => c.id === currentId);
  const noKeys = health !== null && health.keys.enabled === 0;

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        currentId={currentId}
        onSelect={selectChat}
        onNewChat={newChat}
        onRename={renameChat}
        onDelete={deleteChat}
        theme={theme}
        onToggleTheme={toggleTheme}
        dbMode={health?.db ?? null}
        keysEnabled={health ? health.keys.enabled : null}
      />

      <main className="main">
        <header className="chat-header">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            <IconMenu size={17} />
          </button>
          <div className="chat-header-title">{currentChat?.title || 'New chat'}</div>
          <div className="header-actions">
            <ModelSelect value={model} models={models} source={modelSource} onChange={setModel} />
          </div>
        </header>

        {noKeys && (
          <div className="banner">
            <IconKey size={16} />
            <span>
              No NVIDIA API keys configured yet — add one in the Admin panel to start chatting.
            </span>
            <Link href="/admin">Open Admin →</Link>
          </div>
        )}

        <div className="messages" ref={scrollRef} onScroll={onScroll}>
          {messages.length === 0 && !streamMsg ? (
            <EmptyState
              modelName={model.includes('/') ? model.split('/').slice(1).join('/') : model}
              onPick={(p) => setInput(p)}
            />
          ) : (
            <div className="messages-inner">
              {messages.map((m) => (
                <Message key={m.id} msg={m} />
              ))}
              {streamMsg && (
                <Message
                  msg={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamMsg.content,
                    reasoning: streamMsg.reasoning || null,
                    model,
                  }}
                  streaming
                />
              )}
            </div>
          )}
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSend={send}
          onStop={stop}
          streaming={streaming}
          dbLabel={dbLabel}
        />
      </main>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
