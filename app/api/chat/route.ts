import { getStore } from '@/lib/store';
import { chatCompletionsStream, DEFAULT_MODEL, SYSTEM_PROMPT } from '@/lib/nvidia';
import type { ChatMessagesPayload } from '@/lib/nvidia';
import type { StreamEvent } from '@/lib/types';
import type { StoredKey } from '@/lib/store';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CONTEXT_MESSAGES = 30;
const MAX_CONTEXT_CHARS = 60_000;

function deriveTitle(text: string): string {
  let t = (text.trim().split('\n')[0] || 'New Chat')
    .replace(/```[\w-]*\n?/g, '')
    .replace(/[#>*_`~[\]!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 60) t = t.slice(0, 57).trimEnd() + '…';
  return t || 'New Chat';
}

function buildContext(history: { role: string; content: string }[]): ChatMessagesPayload[] {
  const recent = history.slice(-MAX_CONTEXT_MESSAGES);
  const picked: { role: string; content: string }[] = [];
  let budget = MAX_CONTEXT_CHARS;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (budget - m.content.length < 0 && picked.length > 0) break;
    budget -= m.content.length;
    picked.unshift({ role: m.role, content: m.content });
  }
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...picked];
}

export async function POST(req: Request) {
  let chatId: string | null = null;
  try {
    const body = (await req.json()) as {
      chatId?: string | null;
      message?: string;
      model?: string;
    };
    const message = String(body.message ?? '').trim();
    const model = String(body.model ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    if (!message) {
      return Response.json({ error: 'Message is required.' }, { status: 400 });
    }
    if (message.length > 32_000) {
      return Response.json({ error: 'Message is too long (max 32,000 characters).' }, { status: 400 });
    }

    const store = getStore();

    // Find or create the chat.
    let chat = body.chatId ? await store.getChat(String(body.chatId)) : null;
    if (!chat) chat = await store.createChat('New Chat');
    chatId = chat.id;

    await store.addMessage(chat.id, 'user', message, null);

    let title = chat.title;
    if (!title || title === 'New Chat') {
      title = deriveTitle(message);
      await store.renameChat(chat.id, title);
    }

    const history = await store.getMessages(chat.id);
    const payload = buildContext(history);

    // Pick an API key — try every enabled key (least-recently-used first)
    // until one works. Invalid keys are auto-disabled, rate-limited keys
    // are skipped for this request.
    const keys = (await store.listKeys()).filter((k) => k.enabled);
    if (keys.length === 0) {
      return Response.json(
        {
          error:
            'No NVIDIA API keys are configured yet. Open the Admin panel (sidebar → Admin) and add at least one key — it takes 30 seconds at build.nvidia.com.',
          code: 'NO_KEYS',
        },
        { status: 400 }
      );
    }

    let upstream: Response | null = null;
    let usedKey: StoredKey | null = null;
    let lastError = '';
    for (const k of keys) {
      try {
        const res = await chatCompletionsStream(k.key, model, payload);
        if (res.ok && res.body) {
          upstream = res;
          usedKey = k;
          break;
        }
        const errText = (await res.text().catch(() => '')).slice(0, 300);
        lastError = `Key ${k.label || k.id.slice(0, 8)}: HTTP ${res.status}${errText ? ` — ${errText}` : ''}`;
        if (res.status === 401 || res.status === 403) {
          await store.updateKey(k.id, { enabled: false });
          await store.recordKeyFailure(k.id, `Rejected by NVIDIA (HTTP ${res.status}) — key disabled`);
        } else {
          await store.recordKeyFailure(k.id, `HTTP ${res.status}`);
        }
      } catch (e) {
        lastError = `Key ${k.label || k.id.slice(0, 8)}: ${e instanceof Error ? e.message : 'network error'}`;
        await store.recordKeyFailure(k.id, lastError);
      }
    }

    if (!upstream || !usedKey) {
      return Response.json(
        {
          error: `All configured API keys failed. ${lastError} — check the Admin panel.`,
          code: 'ALL_KEYS_FAILED',
        },
        { status: 502 }
      );
    }

    // Mark the winning key as used (LRU rotation) and reset its fail stats.
    await store.markKeyUsed(usedKey.id);
    await store.touchChat(chat.id);

    const finalChatId = chat.id;
    const finalTitle = title;
    const encoder = new TextEncoder();
    let full = '';
    let reasoning = '';
    let persisted = false;

    const persist = async () => {
      if (persisted) return;
      persisted = true;
      try {
        if (full.trim()) {
          await store.addMessage(finalChatId, 'assistant', full, model, reasoning || null);
        }
        await store.touchChat(finalChatId);
      } catch {
        /* best effort */
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (ev: StreamEvent) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
          } catch {
            /* client gone */
          }
        };
        send({ type: 'meta', chatId: finalChatId, chatTitle: finalTitle, model });

        let streamError: string | null = null;
        try {
          const reader = upstream!.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line || !line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;
              let parsed: {
                choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string } }[];
                error?: { message?: string } | string;
              };
              try {
                parsed = JSON.parse(data);
              } catch {
                continue;
              }
              if (parsed.error) {
                streamError =
                  typeof parsed.error === 'string' ? parsed.error : parsed.error.message || 'Upstream error';
                continue;
              }
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;
              const think = delta.reasoning_content || delta.reasoning;
              if (think) {
                reasoning += think;
                send({ type: 'reasoning', text: think });
              }
              if (delta.content) {
                full += delta.content;
                send({ type: 'delta', text: delta.content });
              }
            }
          }
        } catch {
          streamError = 'Connection to the model was interrupted.';
        }

        await persist();

        if (streamError) {
          send({ type: 'error', error: streamError });
        } else if (!full.trim()) {
          send({ type: 'error', error: 'The model returned an empty response. Try again or pick another model.' });
        }

        send({ type: 'done', message: null });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      },
      async cancel() {
        // User pressed "Stop" — save the partial answer.
        await persist();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
