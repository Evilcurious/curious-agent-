'use client';

import { memo, useState } from 'react';
import Markdown from './Markdown';
import Thinking from './Thinking';
import { IconAlert, IconBolt, IconCheck, IconCopy, IconUser } from './Icons';
import type { ChatMessage } from '@/lib/types';

function Message({ msg, streaming = false }: { msg: ChatMessage; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-ai'}`}>
      <div className="msg-avatar">{isUser ? <IconUser size={15} /> : <IconBolt size={15} />}</div>
      <div className="msg-main">
        {msg.reasoning ? <Thinking text={msg.reasoning} streaming={streaming && !msg.content} /> : null}

        {msg.error ? (
          <div className="msg-error">
            <IconAlert size={15} />
            <span>{msg.content}</span>
          </div>
        ) : isUser ? (
          <div className="bubble-user">{msg.content}</div>
        ) : (
          <div className="msg-body-wrap">
            {msg.content ? (
              <>
                <Markdown content={msg.content} streaming={streaming} />
                {streaming && <span className="caret" />}
              </>
            ) : (
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        )}

        {!streaming && !isUser && !msg.error && msg.content && (
          <div className="msg-meta">
            {msg.model && <span className="msg-model">{msg.model}</span>}
            <button className="msg-copy" onClick={copy}>
              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Message);
