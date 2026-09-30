// Shared types used by both the API routes and the client components.

export interface ChatSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string | null;
  model?: string | null;
  created_at?: string;
  /** client-side only: rendered as an error bubble */
  error?: boolean;
}

export interface ApiKeyInfo {
  id: string;
  masked: string;
  label: string;
  enabled: boolean;
  fail_count: number;
  last_error: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface HealthInfo {
  db: 'postgres' | 'memory';
  keys: { total: number; enabled: number };
  chats: number;
  messages: number;
  models: { source: 'live' | 'fallback'; count: number };
}

export interface ModelsResponse {
  models: string[];
  source: 'live' | 'fallback';
  default: string;
}

export type StreamEvent =
  | { type: 'meta'; chatId: string; chatTitle: string; model: string }
  | { type: 'reasoning'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: ChatMessage | null }
  | { type: 'error'; error: string };
