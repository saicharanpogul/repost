# repost.blog (web)

The **read-only** hosted surface: it renders briefs from Supabase and exposes an
open read API. It never fetches X and never calls an LLM — generation happens on
clients (the `../engine` MCP/CLI, on the user's own keys), which publish finished
briefs here.

## How it works

```
GENERATE (client, BYO-key)                 READ (this app, no keys)
  repost MCP/CLI fetches X + synthesizes      visitor/agent opens a page or
  → POST /api/contribute (with a token)       hits /api/brief
                                              → renders from Supabase
```

So the corpus crowdsources itself: each contributor, solving their own problem,
publishes a brief that helps the next reader. Operating cost is just hosting + DB.

## What the server holds

- Supabase keys (anon for read, service role for the `/api/contribute` write).
- A contributor allowlist (`REPOST_PUBLISH_TOKENS`).
- **No X token, no Anthropic key.** Those live only on clients.

## Setup

1. Create a Supabase project → run `supabase/schema.sql` in its SQL editor.
2. `cp .env.example .env.local` and fill in Supabase + your contributor allowlist.
3. `npm install && npm run dev`.

## Routes

| Route | What |
|-------|------|
| `/` | Search (navigates to a brief) + recent briefs |
| `/[person]` | A person's topics |
| `/[person]/[topic]` | The brief; if missing, shows how to generate it locally |
| `GET /api/brief?person=&topic=` | Open read API (404 if not in the corpus yet) |
| `POST /api/contribute` | Publish a brief (Bearer token required; validated) |
| `/sitemap.xml` | Auto from the corpus |

## Provenance & trust

- **Authenticated contributor.** Every publish carries a Bearer token from the
  allowlist; the brief records `contributed_by` (the token's label) and `client`.
  Revocable: drop the token to cut off a bad actor.
- **Checkable sources.** `/api/contribute` rejects any brief whose `sources`
  aren't real `x.com/.../status/...` links, so every claim points at a real post.
- **Transformed only.** Stored = summary + source links + `as_of`. Never raw
  tweet bodies.
- `verified` flag is reserved for future server-side source spot-checks against X.

## Deploy (Vercel)

Root directory = `web/`, add the env vars, point `repost.blog` at it. No
long-running functions needed (no generation here).

## Not done yet

- Sign in with X (real identity instead of shared tokens) for self-serve contributors
- Server-side source spot-verification → flip `verified` to true
- Read-side subscription ($10-20/mo) and/or rate limits
- Moderation / takedown tooling
