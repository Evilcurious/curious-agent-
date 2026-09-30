# ⚡ Curious AI — NVIDIA NIM Chat

A self-hosted, deploy-in-minutes chat interface for **NVIDIA NIM API** models (`build.nvidia.com`), built with Next.js and designed for **Vercel + Neon Postgres**.

![stack](https://img.shields.io/badge/Next.js-15-black) ![nvidia](https://img.shields.io/badge/NVIDIA-NIM-76B900) ![db](https://img.shields.io/badge/Neon-Postgres-00E599)

## Features

- 💬 **Full chat** — streaming replies, Markdown + syntax highlighting, collapsible “thinking” for reasoning models (DeepSeek-R1, Nemotron…)
- 🆕 **New chat / rename / delete / search** — all chats are saved server-side
- 🌓 **Dark & light theme** — toggle in the sidebar, remembered per browser
- 🔑 **Admin panel (open to everyone)** — add **unlimited** NVIDIA API keys at `/admin`; keys are auto-rotated (least-recently-used first), invalid keys are auto-disabled, and each key can be tested / toggled / deleted
- 🤖 **Model picker in the chat** — loads the *live* model catalog from NVIDIA once a key exists (curated fallback list before that)
- 🖥️ **Website preview** — any HTML code block gets a **Code / Preview** tab; the preview runs in a sandboxed iframe and can be opened full-screen in a new tab
- 🗄️ **Neon Postgres storage** — chats, messages and API keys persist in your own database (tables are created automatically)
- 🛟 **Demo mode** — without `DATABASE_URL` the app still runs fully (in-memory), so you can try it before wiring up Neon

## Quick start (local)

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the app, click **Admin** in the sidebar, paste an NVIDIA API key, and start chatting. No `.env` needed for a quick trial (demo mode). To persist data locally, set `DATABASE_URL` in `.env` (copy `.env.example`).

## Deploy to Vercel + Neon (5 steps)

1. **Push this repo to GitHub.**
2. **Create the Postgres database** — go to [neon.tech](https://neon.tech) (free tier) and create a project, **or** open your Vercel project → *Storage* → *Add Database* → **Neon** (Vercel marketplace). The integration sets `DATABASE_URL` for you automatically.
   - If you set it manually, use Neon's **pooled** connection string (the host contains `-pooler`) as the `DATABASE_URL` environment variable in *Vercel → Settings → Environment Variables*.
3. **Import the repo on Vercel** — [vercel.com/new](https://vercel.com/new). Framework preset is detected as Next.js; no build settings needed.
4. **Add environment variables** (if you didn't use the marketplace integration):

   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | ✅ in production | Neon pooled connection string, e.g. `postgresql://user:pass@ep-xxx-pooler-xxx.neon.tech/neondb?sslmode=require` |
   | `NVIDIA_BASE_URL` | — | Only override to proxy the API (default `https://integrate.api.nvidia.com/v1`) |

5. **Deploy**, open your URL, go to **/admin** (or the Admin button in the sidebar) and add one or more NVIDIA API keys.

### Getting an NVIDIA API key

1. Sign in at [build.nvidia.com](https://build.nvidia.com) (free account, includes free credits).
2. Open any model page and click **Get API Key**.
3. Copy the `nvapi-…` key into the Admin panel. Add as many as you like — one per line for bulk.

## How API keys work

- Keys are stored in your database and **never displayed in full again** (masked like `nvapi-••••••abcd`).
- Every chat request tries the **least-recently-used active key**; on failure it automatically falls through to the next key, so you can pool many keys for higher rate limits.
- Keys rejected by NVIDIA (HTTP 401/403) are **disabled automatically** with the error recorded — re-enable or delete them in Admin.
- ⚠️ The Admin panel is intentionally **public** (no login) so everyone who has the URL can access it. Great for personal deployments; be mindful if you share the URL widely.

## Project structure

```
app/
  page.tsx                  # chat UI
  admin/page.tsx            # API key admin panel
  api/chat/route.ts         # streaming chat proxy (key rotation, auto-save)
  api/chats/…               # chat list / rename / delete / messages
  api/keys/…                # key CRUD + test endpoint
  api/models/route.ts       # live NVIDIA model catalog (cached, with fallback)
  api/health/route.ts       # db + key + model stats
components/                 # ChatApp, Sidebar, Message, CodeBlock (preview), …
lib/
  store.ts                  # Postgres (Neon) store + in-memory fallback
  nvidia.ts                 # NVIDIA NIM client helpers
```

## Local end-to-end test without a real key

A mock NVIDIA server is included:

```bash
node test/mock-nvidia.js &            # mock API on :9999
NVIDIA_BASE_URL=http://127.0.0.1:9999/v1 npm run dev
# then add a key starting with "nvapi-" in the Admin panel and chat away
```

## Troubleshooting

| Problem | Fix |
|---|---|
| “No NVIDIA API keys configured” | Add a key in **/admin** |
| “All API keys failed” | Open Admin → *Test* each key; check the recorded error (invalid key → re-add; 429 → rate limited, add more keys) |
| Chats disappear after redeploy | `DATABASE_URL` isn't set on Vercel (demo mode) — add it and redeploy |
| Long answers get cut off | Vercel Hobby caps function time; the route requests 60 s (`maxDuration` in `app/api/chat/route.ts`) |
| Neon connection errors | Use the **pooled** connection string (`-pooler` host) and keep `?sslmode=require` |

---

MIT — do whatever you like. Powered by the NVIDIA NIM API; not affiliated with NVIDIA.
