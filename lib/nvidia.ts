// NVIDIA NIM API helpers (OpenAI-compatible endpoints on build.nvidia.com).

export const NVIDIA_BASE = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(
  /\/+$/,
  ''
);

export const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

// Curated fallback list of popular chat models — used until a live key lets us
// fetch the full catalog from GET /v1/models.
export const FALLBACK_MODELS: string[] = [
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-1b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'deepseek-ai/deepseek-r1',
  'qwen/qwen2.5-coder-32b-instruct',
  'qwen/qwen2.5-7b-instruct',
  'mistralai/mistral-large-2-instruct',
  'mistralai/mixtral-8x22b-instruct-v0.1',
  'google/gemma-2-27b-it',
  'google/gemma-2-9b-it',
  'microsoft/phi-3.5-mini-instruct',
];

// Filter out non-chat models (embeddings, rerankers, vision utilities, …)
// from the live /v1/models catalog.
const NON_CHAT = /embed|rerank|guard|ocr|clip|diffusion|retriev|speech|asr|tts|whisper|paddle|vista|cosmos|biosign|prometheus|neva|usd|esm|molmo|nemo-?multimodal/i;

export const SYSTEM_PROMPT = `You are Curious AI, a helpful, friendly assistant powered by NVIDIA NIM.

Guidelines:
- Answer clearly and concisely using GitHub-flavored Markdown.
- Use fenced code blocks with a language tag (e.g. \`\`\`python or \`\`\`html).
- When the user asks for a web page, website, landing page, dashboard, game or any UI, return ONE complete, self-contained HTML file inside a single \`\`\`html code block. Put all CSS in a <style> tag and all JavaScript in a <script> tag inside that file so it can be previewed instantly. Make the design modern, polished and responsive. Avoid placeholder lorem ipsum — write real copy.
- After the code, add a short explanation of what you built.`;

const MODEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let modelCache: { ids: string[]; at: number } | null = null;

export async function fetchModelIds(key: string): Promise<string[]> {
  const res = await fetch(`${NVIDIA_BASE}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const json = (await res.json()) as { data?: { id?: string }[] };
  const ids = (json.data ?? [])
    .map((m) => (typeof m?.id === 'string' ? m.id : ''))
    .filter((id) => id.length > 0 && !NON_CHAT.test(id));
  return Array.from(new Set(ids)).sort();
}

export function getCachedModels(): string[] | null {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_TTL) return modelCache.ids;
  return null;
}

export function setCachedModels(ids: string[]): void {
  modelCache = { ids, at: Date.now() };
}

export function pickDefault(ids: string[]): string {
  if (ids.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;
  return ids.find((i) => i.includes('llama-3.3')) || ids[0] || DEFAULT_MODEL;
}

export interface ChatMessagesPayload {
  role: string;
  content: string;
}

export function chatCompletionsStream(
  key: string,
  model: string,
  messages: ChatMessagesPayload[]
): Promise<Response> {
  return fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 8192,
      stream: true,
    }),
  });
}
