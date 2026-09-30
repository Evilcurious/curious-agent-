import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { title?: string };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    if (!title) {
      return Response.json({ error: 'Title cannot be empty.' }, { status: 400 });
    }
    const store = getStore();
    const chat = await store.getChat(id);
    if (!chat) return Response.json({ error: 'Chat not found.' }, { status: 404 });
    await store.renameChat(id, title);
    return Response.json({ ok: true, chat: { id, title } });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to rename chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    await store.deleteChat(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
