# repost engine

Turn **"what did {person} say about {topic} on X"** into sourced context your AI
agent can use. This is the retrieval+synthesis core — the moat. Access is cheap;
making the answer *good* is the work.

## Two surfaces, two needs

**Default: retrieval-only (no Anthropic key).** For agents — Claude Code, Codex,
any MCP client. The tool fetches, labels authored-vs-retweet, ranks, and returns
the relevant posts with source links. **Your agent synthesizes it itself**, in
its own context, for free. Calling another LLM to pre-chew data for an LLM is
redundant cost and latency — so we don't.

**Opt-in: `--synthesize` (needs `ANTHROPIC_API_KEY`).** Also writes a
transformed, sourced prose brief. This is the blog/hosted surface, for *humans*,
and the open-core layer where synthesis (the moat + legal shield) lives.

```
topic ──▶ expansion: caller's --terms, or built-in fallback   (LLM only on --synthesize)
      ──▶ topic-scoped X fetch (your BYO key)                 recent + full archive
      ──▶ label authored vs retweet/quote                     RTs aren't their words
      ──▶ rank (authored first, then recency)
      ──▶ [default] return structured posts → agent synthesizes
      ──▶ [--synthesize] also write sourced prose brief (Opus 4.8) + cache it
```

## Setup

Requires **Node 18+**.

```bash
cd engine
npm install
export X_BEARER_TOKEN="..."        # required — your own X API bearer token
# export ANTHROPIC_API_KEY="..."   # only for --synthesize
```

## Run

```bash
# Retrieval-only (no Anthropic key). Your agent does the synthesis.
node cli.mjs -p paulg -t "ai agents"
node cli.mjs -p paulg -t "ai agents" --terms "agentic,tool use,autonomous agents"
node cli.mjs -p paulg -t "ai agents" --window recent --authored-only --json

# Prose brief for humans / the blog (needs ANTHROPIC_API_KEY).
node cli.mjs -p paulg -t "ai agents" --synthesize
```

| Flag | Meaning |
|------|---------|
| `--person`, `-p` | X handle (with or without `@`) — required |
| `--topic`, `-t` | topic to research — required |
| `--terms` | comma-separated expansion terms — your agent supplies these for best recall |
| `--window` | `recent` (~7d) · `archive` (all history) · `both` (default) |
| `--authored-only` | exclude retweets — the person's own words only |
| `--synthesize` | also write a prose brief (needs `ANTHROPIC_API_KEY`) |
| `--no-cache` | skip the local cache |
| `--json` | print the full result object — best for agents/MCP |

## Use it from Claude Code / Codex (MCP)

The retrieval path is also an MCP server (`mcp.mjs`) — no Anthropic key, just the
server's `X_BEARER_TOKEN`. It exposes one tool, `repost_search`, that returns the
labeled, ranked posts for your agent to synthesize.

```bash
# Claude Code
claude mcp add repost --env X_BEARER_TOKEN=<your token> -- node "$PWD/mcp.mjs"
```

For other MCP clients, point them at `node /abs/path/engine/mcp.mjs` (stdio
transport) with `X_BEARER_TOKEN` in the server env. The tool input:

| Field | Notes |
|-------|-------|
| `person` | X handle (required) |
| `topic` | topic to research (required) |
| `terms` | semantic variants — the agent supplies these for recall |
| `window` | `recent` · `archive` · `both` |
| `authored_only` | exclude retweets |

It returns a one-line summary plus a JSON payload of posts (`date`, `kind`,
`text`, `url`). Your agent reasons over that — the server never calls an LLM.

## Why `--terms`

Naive keyword search misses most relevant posts — people say "autonomous
software" or "agentic", not the literal topic. The calling agent is excellent at
generating those variants, so it passes them in. With no `--terms` and no
`--synthesize`, the tool falls back to a trivial split of the topic (weak — pass
terms for real recall). On `--synthesize`, expansion runs through Haiku.

## Models (only on `--synthesize`)

| Stage | Default | Override |
|-------|---------|----------|
| Query expansion | `claude-haiku-4-5` | `REPOST_EXPANSION_MODEL` |
| Synthesis | `claude-opus-4-8` | `REPOST_SYNTHESIS_MODEL` |

Synthesis uses adaptive thinking + `effort: high`; expansion uses structured
outputs.

## Design notes

- **BYO-key, official API only.** Uses the X API with the user's own key. Never
  scrapes HTML, never resells data.
- **Retrieval mode returns post text** to your agent — that's the point, it's
  your own key and personal use. The *hosted* path is the one that must store
  only the transformed synthesis + source links (commentary that cites X, not a
  tweet redistributor) — keep that boundary when you build the hosted layer.
- **Prompt caching** is wired on the synthesis system prompt but only kicks in
  once the prefix exceeds ~4096 tokens; check `usage.cache_read_input_tokens`.
- The thin part is the API access. The retrieval quality (expansion, RT
  labeling, ranking) and the synthesis are the parts worth building.
