'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

function extractText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return '';
}

export default function Markdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }: { children?: React.ReactNode }) => {
            const child = Array.isArray(children) ? children[0] : children;
            const className: string =
              (child as { props?: { className?: string } })?.props?.className || '';
            const match = /language-([\w+-]+)/.exec(className);
            const code = extractText(child);
            if (match || code.includes('\n')) {
              return <CodeBlock code={code} lang={match?.[1] || ''} streaming={streaming} />;
            }
            return <pre className="md-pre">{children}</pre>;
          },
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
