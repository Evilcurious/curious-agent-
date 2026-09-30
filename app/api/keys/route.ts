import { getStore, maskKey } from '@/lib/store';
import type { ApiKeyInfo } from '@/lib/types';
import type { StoredKey } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toInfo(k: StoredKey): ApiKeyInfo {
  const { key: _key, ...rest } = k;
  return { ...rest, masked: maskKey(k.key) };
}

export async function GET() {
  try {
    const store = getStore();
    const keys = await store.listKeys();
    return Response.json({ keys: keys.map(toInfo) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

// Add one or many keys. Body: { key?: string (may contain multiple lines),
// keys?: string[], label?: string }. Unlimited keys are supported.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      key?: string;
      keys?: string[];
      label?: string;
    };
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 100) : '';

    const lines: string[] = [];
    if (typeof body.key === 'string') lines.push(...body.key.split('\n'));
    if (Array.isArray(body.keys)) {
      for (const k of body.keys) if (typeof k === 'string') lines.push(...k.split('\n'));
    }

    const seen = new Set<string>();
    const entries: { key: string; label: string }[] = [];
    for (const raw of lines) {
      const key = raw.trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, label });
    }

    if (entries.length === 0) {
      return Response.json({ error: 'No API keys were provided.' }, { status: 400 });
    }

    const store = getStore();
    const result = await store.addKeys(entries);
    const keys = await store.listKeys();
    return Response.json({ ...result, keys: keys.map(toInfo) }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to add API keys' },
      { status: 500 }
    );
  }
}
