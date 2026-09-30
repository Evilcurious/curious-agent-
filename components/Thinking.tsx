'use client';

import { useEffect, useState } from 'react';
import { IconChevron } from './Icons';

export default function Thinking({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(streaming);

  // Collapse automatically once the visible answer starts arriving.
  useEffect(() => {
    if (!streaming) setOpen(false);
  }, [streaming]);

  return (
    <div className={`think ${open ? 'open' : ''}`}>
      <button className="think-toggle" onClick={() => setOpen(!open)}>
        <span className="think-label">{streaming ? 'Thinking…' : 'Thought process'}</span>
        <IconChevron size={13} className="think-chev" />
      </button>
      {open && <div className="think-body">{text}</div>}
    </div>
  );
}
