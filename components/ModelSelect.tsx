'use client';

import { useEffect, useRef, useState } from 'react';
import { IconBolt, IconCheck, IconChevron } from './Icons';

export default function ModelSelect({
  value,
  models,
  source,
  onChange,
}: {
  value: string;
  models: string[];
  source: 'live' | 'fallback';
  onChange: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const short = value.includes('/') ? value.split('/').slice(1).join('/') : value;

  return (
    <div className={`ms ${open ? 'open' : ''}`} ref={ref}>
      <button className="ms-btn" onClick={() => setOpen(!open)} title={`Model: ${value}`}>
        <IconBolt size={13} className="ms-bolt" />
        <span className="ms-value">{short}</span>
        {source === 'fallback' && <span className="ms-tag">curated list</span>}
        <IconChevron size={14} className="ms-chev" />
      </button>
      {open && (
        <div className="ms-menu">
          <div className="ms-note">
            {models.length} models · {source === 'live' ? 'live catalog from NVIDIA' : 'add an API key in Admin to load the live catalog'}
          </div>
          <div className="ms-list">
            {models.map((m) => (
              <button
                key={m}
                className={`ms-item ${m === value ? 'sel' : ''}`}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
              >
                <span className="ms-model">{m.includes('/') ? m.split('/').slice(1).join('/') : m}</span>
                <span className="ms-vendor">{m.includes('/') ? m.split('/')[0] : 'nvidia'}</span>
                {m === value && <IconCheck size={13} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
