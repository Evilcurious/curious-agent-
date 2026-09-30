import { getStore } from '@/lib/store';
import { fetchModelIds } from '@/lib/nvidia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Test an API key against GET /v1/models. Body: { key?: string } to test a
// not-yet-saved key, or { id?: string } to test a stored one.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { key?: string; id?: string };
    let key = '';
    if (typeof body.key === 'string' && body.key.trim()) {
      key = body.key.trim();
    } else if (typeof body.id === 'string' && body.id) {
      const store = getStore();
      const stored = (await store.listKeys()).find((k) => k.id === body.id);
      if (!stored) return Response.json({ error: 'Key not found.' }, { status: 404 });
      key = stored.key;
    } else {
      return Response.json({ error: 'Provide a key or a key id.' }, { status: 400 });
    }

    try {
      const models = await fetchModelIds(key);
      return Response.json({ ok: true, count: models.length, sample: models.slice(0, 5) });
    } catch (e) {
      return Response.json({
        ok: false,
        error: e instanceof Error ? e.message : 'Key test failed',
      });
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Test request failed' },
      { status: 500 }
    );
  }
}
