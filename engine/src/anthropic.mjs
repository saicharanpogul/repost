// repost engine — optional LLM layer (synthesis + smart expansion)
//
// This is ONLY used on the opt-in synthesis path (--synthesize), i.e. the
// blog/hosted surface where a human reads prose. The default agent/MCP path
// does NOT touch this file and needs no Anthropic key — the calling agent
// (Claude Code, Codex) synthesizes in its own context.
//
// The client is constructed lazily so importing this module without a key never
// throws — only calling expandQuery/synthesize requires ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

export const EXPANSION_MODEL = process.env.REPOST_EXPANSION_MODEL || "claude-haiku-4-5";
export const SYNTHESIS_MODEL = process.env.REPOST_SYNTHESIS_MODEL || "claude-opus-4-8";

export const llmAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

let _client;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required for --synthesize / LLM expansion. The default retrieval path does not need it.");
    }
    _client = new Anthropic();
  }
  return _client;
}

// See note in README: cache_control only caches once the prefix exceeds the
// model minimum (~4096 tokens). Harmless below that; verify with
// usage.cache_read_input_tokens.

const EXPANSION_SYSTEM = `You expand a research topic into search terms for finding what a specific person said about it on X/Twitter.

Naive keyword search misses most relevant posts: people express an idea in many ways and rarely use the exact topic phrase. List the distinct phrasings, synonyms, and closely-related concepts someone would actually use when posting about this topic.

Rules:
- Return 6-12 terms. Include the literal topic and its variants, plus semantic neighbors (e.g. for "AI agents": "autonomous agents", "agentic", "tool use", "agent harness").
- Prefer short, high-signal terms. Multi-word phrases are fine; they get quoted in the query.
- Do NOT include the person's name/handle, hashtags, or operators.
- Avoid terms so generic they'd match unrelated posts.`;

const EXPANSION_SCHEMA = {
  type: "object",
  properties: { terms: { type: "array", items: { type: "string" } } },
  required: ["terms"],
  additionalProperties: false,
};

export async function expandQuery(topic) {
  const res = await client().messages.create({
    model: EXPANSION_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: EXPANSION_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: EXPANSION_SCHEMA } },
    messages: [{ role: "user", content: `Topic: ${topic}` }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  const terms = Array.isArray(parsed.terms) ? parsed.terms : [];
  if (!terms.some((t) => t.toLowerCase() === topic.toLowerCase())) terms.unshift(topic);
  return terms;
}

const SYNTHESIS_SYSTEM = `You write a sourced, trustworthy summary of what a specific person has said about a topic on X/Twitter, based ONLY on the posts provided.

Output a concise markdown brief:
- A 1-2 sentence overview of their stance.
- "Over time": key claims in rough chronological order, each a bullet with the date and an inline source link.
- A short "Caveats" line noting limits (small sample, recency) when relevant.

Hard rules:
- TRANSFORM, do not reproduce. Paraphrase in your own words. Never quote a post's full text; a short distinctive phrase is fine. The value is your synthesis.
- Attribute every claim with (date, source link) from the provided posts. Never invent a claim, date, or link.
- Distinguish AUTHORED posts from RETWEETS/QUOTES (amplification of others). Retweets are not the person's authored position — label them, and lead with authored material.
- If posts are thin or off-topic, say so plainly. "Limited signal: only N relevant posts, mostly amplification" is a correct answer. Do not pad.
- No preamble. Start with the brief.`;

export async function synthesize({ person, topic, tweets }) {
  const corpus = tweets
    .map((t, i) => `[${i + 1}] ${t.date || "undated"} | ${t.kind} | ${t.url}\n${t.text.replace(/\s+/g, " ").trim()}`)
    .join("\n\n");

  const res = await client().messages.create({
    model: SYNTHESIS_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [{ type: "text", text: SYNTHESIS_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: `Person: @${person}\nTopic: ${topic}\n\nProvided posts (id | date | kind | url, then text):\n\n${corpus}` },
    ],
  });

  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
