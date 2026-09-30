import { getStore, maskKey } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { enabled?: boolean; label?: string };
    const patch: { enabled?: boolean; label?: string } = {};
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body.label === 'string') patch.label = body.label.trim().slice(0, 100);
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    }
    const store = getStore();
    await store.updateKey(id, patch);
    const keys = await store.listKeys();
    return Response.json({
      ok: true,
      keys: keys.map((k) => {
        const { key: _key, ...rest } = k;
        return { ...rest, masked: maskKey(k.key) };
      }),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to update key' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    await store.deleteKey(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to delete key' },
      { status: 500 }
    );
  }
}
