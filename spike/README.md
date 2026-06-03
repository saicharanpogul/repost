# repost — X API spike

A 30-minute validation instrument. **Not the product.** It answers the one technical
question the design doc flagged as an open risk: *can a bring-your-own X API key pull
topic-scoped tweets for one person, recent vs. historical, and what does it cost?*

## What it checks

1. **Recent search** works on your tier? (`/2/tweets/search/recent`, ~last 7 days)
2. **Full-archive search** works, or is it gated? (`/2/tweets/search/all`, all history)
3. **Volume** — how many tweets a real topic query returns.
4. **Cost** — at pay-per-use ($0.005/read), per spike run and per on-demand user query.

## Run it

Requires **Node 18+** (uses native `fetch`). No dependencies, no install.

```bash
# 1. Get an app-only Bearer token:
#    https://developer.x.com → your app → Keys and tokens → Bearer Token
export X_BEARER_TOKEN="AAAA..."

# 2. Run with the default query (Paul Graham on AI agents):
node spike/x-api-spike.mjs

# 3. Or pass your own query:
node spike/x-api-spike.mjs 'from:karpathy ("agents" OR "RL")'

# Optional: pull more pages to gauge true volume (each page ≤100 reads):
MAX_PAGES=2 node spike/x-api-spike.mjs
```

## Cost guardrail

Default `MAX_PAGES=1` reads at most ~100 tweets per endpoint (~200 total ≈ $1). Bump
`MAX_PAGES` only if you need a truer volume estimate — it scales the cost linearly.

## Reading the verdict

- **Both work** → on-demand can ship full "over time" context on day one.
- **Recent only** → ship recent-context first; historical depth needs a higher tier or
  accrues slowly through the cache. This is fine for a v1 on a fast-moving stack.
- **Recent fails** → fix the token/tier before trusting any demand test. Nothing
  downstream is reliable until this returns.

Paste the output back into the office-hours session to update the design doc's
`OPEN TECHNICAL RISK` line with the real answer.
