# repost

**X/Twitter context for AI agents.** Ask "what did {person} say about {topic} on
X" and get sourced posts your coding agent can actually use.

Claude Code, Codex, and other AI tools have no native access to X. Today you
paste screenshots or tweet text by hand — links don't even expand. repost closes
that gap: it fetches the relevant posts for a person and topic, labels what's
authored vs amplified, and hands your agent clean, sourced material to reason
over.

## The idea in one line

Access to tweets is cheap and commoditizing. The value is **turning the firehose
into a trustworthy, sourced answer about who said what.** That's what this builds.

## Two surfaces

- **Agent / MCP (default, no Anthropic key).** The tool fetches → labels
  authored vs retweet → ranks → returns structured posts with source links. Your
  agent synthesizes in its own context. Calling another LLM to pre-chew data for
  an LLM is redundant cost and latency, so it doesn't. BYO X key only.
- **Blog / hosted (opt-in, `--synthesize`).** Also writes a transformed, sourced
  prose brief for humans. The cached, transformed page is the moat and the legal
  shield — commentary that cites X, not a tweet redistributor. This is the
  open-core layer, not the free tool.

## Layout

| Path | What |
|------|------|
| [`engine/`](engine/) | Retrieval+synthesis core, CLI, and the MCP server. Start here. |
| [`spike/`](spike/) | One-off X API viability probe (recent + full-archive, cost check). |

## Quick start

```bash
cd engine
npm install
export X_BEARER_TOKEN="..."            # your own X API bearer token

# Retrieval-only (no Anthropic key) — your agent synthesizes:
node cli.mjs -p paulg -t "ai agents" --terms "agentic,tool use,autonomous agents"

# Prose brief for humans (needs ANTHROPIC_API_KEY):
node cli.mjs -p paulg -t "ai agents" --synthesize
```

Use it from Claude Code as a tool:

```bash
claude mcp add repost --env X_BEARER_TOKEN=<your token> -- node "$PWD/engine/mcp.mjs"
```

Full docs: [`engine/README.md`](engine/README.md).

## Design principles

- **BYO-key, official API only.** Uses the X API with the user's own key. Never
  scrapes HTML, never resells data.
- **The agent path needs no Anthropic key.** Synthesis (and its cost) lives only
  on the hosted/blog surface, where the moat and revenue are.
- **Retweets are not the person's words.** Authored posts are labeled and ranked
  first; amplification is marked as such.

## Status

Early. The retrieval path + MCP server work; the spike confirmed X API
viability (recent + full-archive, ~$0.015 per fresh topic query). Next up is
validating real demand by dogfooding, then deciding whether to harden the OSS
tool and build the hosted layer. See the roadmap below.

## Roadmap

- [x] X API viability spike (recent + archive, cost)
- [x] Retrieval engine (expansion, RT labeling, ranking, cache)
- [x] MCP server (`repost_search`) for Claude Code / Codex
- [ ] Dogfood for real work; confirm the pain is painkiller-grade
- [ ] Publish to npm / MCP registry; install snippet hardening
- [ ] Optional hosted layer: shared demand-weighted corpus + blog (open-core)

## License

[MIT](LICENSE)
