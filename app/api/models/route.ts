import { getStore } from '@/lib/store';
import {
  getCachedModels,
  FALLBACK_MODELS,
  fetchModelIds,
  pickDefault,
  setCachedModels,
} from '@/lib/nvidia';
import type { ModelsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const cached = getCachedModels();
  if (cached) {
    const payload: ModelsResponse = { models: cached, source: 'live', default: pickDefault(cached) };
    return Response.json(payload);
  }

  try {
    const store = getStore();
    const keys = (await store.listKeys()).filter((k) => k.enabled);
    for (const k of keys) {
      try {
        const ids = await fetchModelIds(k.key);
        if (ids.length > 0) {
          setCachedModels(ids);
          const payload: ModelsResponse = { models: ids, source: 'live', default: pickDefault(ids) };
          return Response.json(payload);
        }
      } catch {
        // try the next key
      }
    }
  } catch {
    // fall through to the curated list
  }

  const payload: ModelsResponse = {
    models: FALLBACK_MODELS,
    source: 'fallback',
    default: pickDefault(FALLBACK_MODELS),
  };
  return Response.json(payload);
}
