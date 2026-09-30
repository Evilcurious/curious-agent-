import { getStore } from '@/lib/store';
import { getCachedModels, FALLBACK_MODELS } from '@/lib/nvidia';
import type { HealthInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const store = getStore();
    // Lazy cleanup: drop previews that are past their 5-minute TTL.
    await store.purgeExpiredPreviews().catch(() => undefined);
    const stats = await store.stats();
    const cached = getCachedModels();
    const health: HealthInfo = {
      db: store.kind,
      keys: { total: stats.keys, enabled: stats.keysEnabled },
      chats: stats.chats,
      messages: stats.messages,
      previews: stats.previews,
      models: { source: cached ? 'live' : 'fallback', count: (cached ?? FALLBACK_MODELS).length },
    };
    return Response.json(health);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Health check failed' },
      { status: 500 }
    );
  }
}
