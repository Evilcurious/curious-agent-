import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const store = getStore();
    const chats = await store.listChats();
    return Response.json({ chats });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to list chats' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : 'New Chat';
    const store = getStore();
    const chat = await store.createChat(title);
    return Response.json({ chat }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to create chat' },
      { status: 500 }
    );
  }
}
