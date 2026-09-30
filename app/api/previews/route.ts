import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create a hosted website preview (stored in Postgres/Neon).
// Previews are served at /p/<id> and auto-delete 5 minutes after creation.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { html?: string };
    const html = String(body.html ?? '');
    if (!html.trim()) {
      return Response.json({ error: 'No HTML provided.' }, { status: 400 });
    }
    if (html.length > 500_000) {
      return Response.json({ error: 'Preview is too large (max 500 KB).' }, { status: 413 });
    }

    const store = getStore();
    await store.purgeExpiredPreviews();
    const preview = await store.createPreview(html);

    return Response.json(
      { id: preview.id, url: `/p/${preview.id}`, expiresAt: preview.expires_at },
      { status: 201 }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Failed to create preview' },
      { status: 500 }
    );
  }
}
