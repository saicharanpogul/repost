# repost.blog (web)

The hosted surface: a Next.js app that publishes sourced summaries of what people
said on X, and an open API for agents. On-demand generation, cached in Supabase.

## How it works

```
visitor/agent asks (person, topic)
  → check Supabase for a fresh brief
  → miss/stale: expand topic → fetch X (operator key) → synthesize (Opus 4.8)
               → store TRANSFORMED brief (summary + source links, no raw tweets)
  → render the blog page / return JSON
```

Everyone after the first request reads the cached brief. The corpus assembles
itself toward what people actually ask for.

## Setup

1. **Create a Supabase project**, then run `supabase/schema.sql` in its SQL editor.
2. **Env:** copy `.env.example` to `.env.local` and fill in Supabase, X, and
   Anthropic keys.
3. Install and run:

```bash
npm install
npm run dev
```

## Routes

| Route | What |
|-------|------|
| `/` | Search + recent briefs |
| `/[person]` | A person's topics |
| `/[person]/[topic]` | The brief (blog page); generates on demand if missing |
| `/api/brief?person=&topic=` | Open JSON API (GET for agents, POST for the UI) |
| `/sitemap.xml` | Auto from the brief corpus |

## Deploy (Vercel)

Set the project **root directory** to `web/`, add the env vars from
`.env.example`, and point the `repost.blog` domain at it. Generation runs in a
serverless function (`maxDuration = 60`).

## Boundaries

- **Server-side keys.** Visitors never bring keys; the operator pays for reads +
  synthesis. (Contrast the `../engine` MCP tool, which is BYO-key, no synthesis.)
- **Stored = transformed only.** Briefs hold the summary + source links + an
  `as-of` date. Never raw tweet bodies. Commentary that cites X, not a
  redistributor.
- **Public, no paywall yet.** Schema is subscription-ready; distribution first.

## Not done yet

- Auth / subscriptions ($10-20/mo gate)
- Rate limiting on generation (currently gated behind an explicit click)
- Background refresh of stale briefs (today: lazy, on next visit past TTL)
- Per-person "sync enabled" opt-in flows
