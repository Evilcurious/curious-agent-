'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/common';
import { IconCheck, IconCode, IconCopy, IconEye, IconExternal, IconLink } from './Icons';

const PREVIEW_LANGS = new Set(['html', 'htm', 'xhtml']);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeLang(lang: string): string {
  if (lang === 'htm' || lang === 'xhtml') return 'html';
  return lang;
}

function isPreviewable(lang: string, code: string): boolean {
  if (PREVIEW_LANGS.has(lang)) return true;
  return /<!doctype html|<html[\s>]|<body[\s>]/i.test(code);
}

function toDocument(code: string): string {
  if (/<html[\s>]|<!doctype/i.test(code)) return code;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${code}</body></html>`;
}

export default function CodeBlock({
  code,
  lang,
  streaming = false,
}: {
  code: string;
  lang?: string;
  streaming?: boolean;
}) {
  const language = normalizeLang((lang || '').toLowerCase());
  const previewable = isPreviewable(language, code);
  const [tab, setTab] = useState<'code' | 'preview'>(previewable && !streaming ? 'preview' : 'code');
  const userPicked = useRef(false);
  const [copied, setCopied] = useState(false);
  const [linkState, setLinkState] = useState<'idle' | 'creating' | 'copied'>('idle');

  // When generation finishes, auto-switch to the Preview tab for HTML.
  useEffect(() => {
    if (previewable && !streaming && !userPicked.current) setTab('preview');
  }, [previewable, streaming]);

  const html = useMemo(() => {
    if (streaming) return escapeHtml(code);
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      }
    } catch {
      /* fall through */
    }
    return escapeHtml(code);
  }, [code, language, streaming]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Host the generated page in the database (Neon) and open it at /p/<id>.
  // Hosted previews auto-delete 5 minutes after creation.
  const openHosted = async () => {
    const win = window.open('about:blank', '_blank');
    const fallback = () => {
      const blob = new Blob([toDocument(code)], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
    try {
      const r = await fetch('/api/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: toDocument(code) }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'Failed to create preview');
      if (win) win.location.href = j.url;
      else window.open(j.url, '_blank');
    } catch {
      fallback();
    }
  };

  const copyLink = async () => {
    setLinkState('creating');
    try {
      const r = await fetch('/api/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: toDocument(code) }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'Failed to create preview');
      await navigator.clipboard.writeText(`${window.location.origin}${j.url}`);
      setLinkState('copied');
      setTimeout(() => setLinkState('idle'), 2000);
    } catch {
      setLinkState('idle');
    }
  };

  const pick = (t: 'code' | 'preview') => {
    userPicked.current = true;
    setTab(t);
  };

  return (
    <div className="cb">
      <div className="cb-head">
        <div className="cb-tabs">
          <button
            className={`cb-tab ${tab === 'code' ? 'active' : ''}`}
            onClick={() => pick('code')}
            title="Show source code"
          >
            <IconCode size={13} /> Code
          </button>
          {previewable && (
            <button
              className={`cb-tab ${tab === 'preview' ? 'active' : ''}`}
              onClick={() => pick('preview')}
              title="Live preview"
            >
              <IconEye size={13} /> Preview
            </button>
          )}
        </div>
        <div className="cb-actions">
          <span className="cb-lang">{language || 'text'}</span>
          <button className="mini-btn" onClick={copy} title="Copy code">
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          </button>
          {previewable && !streaming && (
            <>
              <button
                className="mini-btn"
                onClick={copyLink}
                disabled={linkState === 'creating'}
                title="Copy shareable preview link (hosted for 5 minutes)"
              >
                {linkState === 'copied' ? <IconCheck size={13} /> : <IconLink size={13} />}
              </button>
              <button
                className="mini-btn"
                onClick={openHosted}
                title="Open hosted preview in a new tab (hosted for 5 minutes)"
              >
                <IconExternal size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      {tab === 'code' ? (
        <pre className="cb-pre">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <div className="cb-preview">
          <iframe
            title="Website preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            srcDoc={toDocument(code)}
          />
          <span className="preview-note">live preview · sandboxed</span>
        </div>
      )}
    </div>
  );
}
