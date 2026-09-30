'use client';

import { useEffect, useRef } from 'react';
import { IconSend, IconStop } from './Icons';

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  dbLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  dbLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          rows={1}
          placeholder="Ask anything — try “build me a landing page”…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        {streaming ? (
          <button className="stop-btn" onClick={onStop} title="Stop generating">
            <IconStop size={15} />
          </button>
        ) : (
          <button className="send-btn" onClick={onSend} disabled={!value.trim()} title="Send message">
            <IconSend size={16} />
          </button>
        )}
      </div>
      <div className="composer-hint">
        Enter ↵ to send · Shift+Enter for a new line · {dbLabel}
      </div>
    </div>
  );
}
