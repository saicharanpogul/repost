// Server-side LLM layer: semantic query expansion (Haiku) + sourced synthesis
// (Opus 4.8). This is the hosted/blog surface — the operator pays for it, and
// the transformed output (not raw tweets) is what gets cached and published.

import Anthropic from "@anthropic-ai/sdk";
import type { Tweet } from "./x";

export const EXPANSION_MODEL = process.env.REPOST_EXPANSION_MODEL || "claude-haiku-4-5";
export const SYNTHESIS_MODEL = process.env.REPOST_SYNTHESIS_MODEL || "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
    _client = new Anthropic();
  }
  return _client;
}

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

export async function expandQuery(topic: string): Promise<string[]> {
  const res: any = await client().messages.create({
    model: EXPANSION_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: EXPANSION_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: EXPANSION_SCHEMA } },
    messages: [{ role: "user", content: `Topic: ${topic}` }],
  } as any);
  const text = res.content.find((b: any) => b.type === "text")?.text ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { /* keep {} */ }
  const terms: string[] = Array.isArray(parsed.terms) ? parsed.terms : [];
  if (!terms.some((t) => t.toLowerCase() === topic.toLowerCase())) terms.unshift(topic);
  return terms;
}

const SYNTHESIS_SYSTEM = `You write a sourced, trustworthy summary of what a specific person has said about a topic on X/Twitter, based ONLY on the posts provided. The output is published as a blog page that cites X.

Output a concise markdown brief (no top-level # heading — the page adds the title):
- A 1-2 sentence overview of their stance.
- A "## Over time" section: key claims in rough chronological order, each a bullet with the date and an inline source link.
- A short "## Caveats" line noting limits (small sample, recency) when relevant.

Hard rules:
- TRANSFORM, do not reproduce. Paraphrase in your own words. Never quote a post's full text; a short distinctive phrase is fine. The value is your synthesis.
- Attribute every claim with (date, source link) from the provided posts. Never invent a claim, date, or link.
- Distinguish AUTHORED posts from RETWEETS/QUOTES (amplification of others). Retweets are not the person's authored position — label them, and lead with authored material.
- If posts are thin or off-topic, say so plainly. "Limited signal: only N relevant posts, mostly amplification" is a correct answer. Do not pad.
- No preamble. Start with the overview sentence.`;

export async function synthesize(person: string, topic: string, tweets: Tweet[]): Promise<string> {
  const corpus = tweets
    .map((t, i) => `[${i + 1}] ${t.date || "undated"} | ${t.kind} | ${t.url}\n${t.text.replace(/\s+/g, " ").trim()}`)
    .join("\n\n");

  const res: any = await client().messages.create({
    model: SYNTHESIS_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [{ type: "text", text: SYNTHESIS_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: `Person: @${person}\nTopic: ${topic}\n\nProvided posts (id | date | kind | url, then text):\n\n${corpus}` },
    ],
  } as any);

  return res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
}
