import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const chat = await store.getChat(id);
    if (!chat) return Response.json({ error: 'Chat not found.' }, { status: 404 });
    const messages = await store.getMessages(id);
    return Response.json({ messages });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to load messages' },
      { status: 500 }
    );
  }
}
