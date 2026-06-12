// repost engine — orchestrator
//
// Default mode is RETRIEVAL-ONLY (no Anthropic key): expand terms (caller-
// supplied or a cheap built-in fallback), fetch topic-scoped posts, label
// authored vs retweet, rank, and return the structured posts. The calling
// agent (Claude Code, Codex) does the synthesis itself.
//
// SYNTHESIS mode (opt-in, needs ANTHROPIC_API_KEY) additionally writes a
// transformed, sourced prose brief — the blog/hosted surface for humans.

import { llmAvailable, expandQuery, synthesize, SYNTHESIS_MODEL } from "./anthropic.mjs";
import { fetchTweets } from "./x-client.mjs";
import { cacheKey, readCache, writeCache } from "./cache.mjs";

const KIND_PRIORITY = { authored: 0, quote: 1, reply: 2, retweet: 3 };

// Deterministic, no-LLM expansion. Weak on its own — the agent is expected to
// pass good `terms`; this is just a floor so a bare topic still returns
// something.
function fallbackExpand(topic) {
  const phrase = topic.trim();
  const words = phrase.split(/\s+/).filter((w) => w.length > 2);
  return [...new Set([phrase, ...words])];
}

function rank(tweets, cap = 40) {
  return [...tweets]
    .sort((a, b) => {
      const k = (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9);
      if (k !== 0) return k;
      return String(b.date || "").localeCompare(String(a.date || ""));
    })
    .slice(0, cap);
}

export async function runEngine({
  person,
  topic,
  token,
  terms = null, // caller-supplied expansion terms (preferred)
  window = "both",
  authoredOnly = false,
  synthesize: doSynth = false,
  useCache = true,
  onStep = () => {},
}) {
  const handle = person.replace(/^@/, "");
  const mode = doSynth ? "synthesis" : "retrieval";
  const key = cacheKey(handle, topic, mode);

  if (useCache) {
    const hit = readCache(key);
    if (hit) { onStep("cache hit"); return { ...hit, cached: true }; }
  }

  // Resolve expansion terms: caller-supplied > LLM (synthesis mode only) > fallback.
  let resolvedTerms = Array.isArray(terms) && terms.length ? terms : null;
  if (!resolvedTerms && doSynth && llmAvailable()) {
    onStep("expanding query (LLM)");
    resolvedTerms = await expandQuery(topic);
  }
  if (!resolvedTerms) resolvedTerms = fallbackExpand(topic);

  onStep(`fetching posts (${resolvedTerms.length} terms)`);
  const { query, usedTerms, totalTerms, tweets, notes } = await fetchTweets({ handle, terms: resolvedTerms, token, window, authoredOnly });

  if (!tweets.length) {
    return { person: handle, topic, mode, posts: [], answer: null, terms: resolvedTerms, query, notes, cached: false, note: "No matching posts for this query." };
  }

  const ranked = rank(tweets);
  const counts = ranked.reduce((acc, t) => ((acc[t.kind] = (acc[t.kind] || 0) + 1), acc), {});

  let answer = null;
  if (doSynth) {
    onStep(`synthesizing from ${ranked.length} posts`);
    answer = await synthesize({ person: handle, topic, tweets: ranked });
  }

  const result = {
    person: handle,
    topic,
    mode,
    window,
    model: doSynth ? SYNTHESIS_MODEL : null,
    generatedAt: new Date().toISOString(),
    // Structured posts for the calling agent (includes text — this is the
    // user's own key, personal use; returning content is the whole point).
    posts: ranked.map((t) => ({ date: t.date, kind: t.kind, text: t.text, url: t.url })),
    answer, // null in retrieval mode
    terms: resolvedTerms,
    query,
    usedTerms,
    totalTerms,
    counts,
    notes,
    cached: false,
  };

  writeCache(key, result);
  return result;
}
