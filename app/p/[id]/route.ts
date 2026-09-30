import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Hosted website preview: serves the stored HTML at /p/<id>.
// Previews are purged lazily — they are deleted 5 minutes after creation.

const EXPIRED_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview expired</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #0b0d10; color: #e7eaef; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { text-align: center; padding: 40px 44px; border-radius: 18px; background: #15181e; border: 1px solid #242a33; max-width: 420px; }
  .icon { font-size: 34px; }
  h1 { font-size: 20px; margin: 14px 0 8px; }
  p { color: #98a2b3; font-size: 14px; line-height: 1.6; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">&#9203;</div>
    <h1>This preview has expired</h1>
    <p>Hosted previews are automatically deleted 5 minutes after they are created.<br>Ask the AI to generate the page again to get a fresh one.</p>
  </div>
</body>
</html>`;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    await store.purgeExpiredPreviews();
    const preview = await store.getPreview(id);

    if (!preview) {
      return new Response(EXPIRED_PAGE, {
        status: 410,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    return new Response(preview.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        // Run the preview in a sandboxed context so it cannot touch this app's origin.
        'Content-Security-Policy': 'sandbox allow-scripts allow-forms allow-modals allow-popups',
      },
    });
  } catch {
    return new Response(EXPIRED_PAGE, {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
