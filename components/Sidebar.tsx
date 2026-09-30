'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconBolt,
  IconChat,
  IconClose,
  IconKey,
  IconMoon,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSun,
  IconTrash,
} from './Icons';
import type { ChatSummary } from '@/lib/types';

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Sidebar({
  open,
  onClose,
  chats,
  currentId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  theme,
  onToggleTheme,
  dbMode,
  keysEnabled,
}: {
  open: boolean;
  onClose: () => void;
  chats: ChatSummary[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  dbMode: 'postgres' | 'memory' | null;
  keysEnabled: number | null;
}) {
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const visible = filter.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : chats;

  const startRename = (c: ChatSummary) => {
    setConfirmId(null);
    setEditingId(c.id);
    setEditValue(c.title);
  };

  const commitRename = () => {
    if (editingId) {
      const t = editValue.trim();
      if (t) onRename(editingId, t);
    }
    setEditingId(null);
  };

  const askDelete = (id: string) => {
    setEditingId(null);
    if (confirmId === id) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmId(null);
      onDelete(id);
    } else {
      setConfirmId(id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmId(null), 2600);
    }
  };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">
            <IconBolt size={17} />
          </div>
          <div>
            <div className="brand-name">Curious AI</div>
            <div className="brand-sub">NVIDIA NIM chat</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} title="Close sidebar">
            <IconClose size={16} />
          </button>
        </div>

        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={onNewChat}>
            <IconPlus size={15} /> New chat
          </button>
          <div className="search-wrap">
            <IconSearch size={14} />
            <input
              placeholder="Search chats…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="chat-list">
          {visible.length === 0 && (
            <div className="sidebar-empty">
              {filter ? 'No chats match your search.' : 'No chats yet — start a new one!'}
            </div>
          )}
          {visible.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${c.id === currentId ? 'active' : ''}`}
              onClick={() => editingId !== c.id && onSelect(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingId !== c.id) onSelect(c.id);
              }}
            >
              <span className="chat-item-icon">
                <IconChat size={15} />
              </span>
              {editingId === c.id ? (
                <input
                  className="rename-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={commitRename}
                  maxLength={200}
                />
              ) : (
                <div className="chat-item-main">
                  <div className="chat-item-title">{c.title || 'New Chat'}</div>
                  <div className="chat-item-meta">
                    {c.message_count} msg · {timeAgo(c.updated_at)}
                  </div>
                </div>
              )}
              {editingId !== c.id && (
                <div className="chat-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="mini-btn" title="Rename chat" onClick={() => startRename(c)}>
                    <IconPencil size={13} />
                  </button>
                  <button
                    className={`mini-btn danger ${confirmId === c.id ? 'confirm' : ''}`}
                    title={confirmId === c.id ? 'Click again to confirm' : 'Delete chat'}
                    onClick={() => askDelete(c.id)}
                  >
                    {confirmId === c.id ? 'Sure?' : <IconTrash size={13} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="db-badge">
            <span className={`db-dot ${dbMode === 'postgres' ? 'on' : dbMode === 'memory' ? 'demo' : 'on'}`} />
            {dbMode === 'postgres'
              ? 'Database connected — history saved'
              : dbMode === 'memory'
                ? 'Demo mode — set DATABASE_URL to save history'
                : 'Checking database…'}
          </div>
          <div className="footer-btns">
            <button className="foot-btn" onClick={onToggleTheme} title="Switch theme">
              {theme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <Link className="foot-btn" href="/admin" title="Admin — API keys">
              <IconKey size={14} /> Admin
              {keysEnabled === 0 && <span className="warn-dot" />}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
