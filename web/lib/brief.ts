// Brief orchestration: the on-demand + cache path.
// getOrGenerateBrief checks the DB first; on a miss or a stale row it expands
// the topic, fetches topic-scoped posts, synthesizes, and upserts a transformed
// brief (summary + source links — never raw tweet bodies).

import { supabaseAdmin, supabaseRead } from "./supabase";
import { fetchTweets, type Tweet } from "./x";
import { expandQuery, synthesize, SYNTHESIS_MODEL } from "./synthesize";
import { briefSlug, normalizeHandle } from "./slug";
import { assertGenerationEnv } from "./env";
import type { Brief, BriefWindow, Source } from "./types";

const TTL_MS: Record<BriefWindow, number> = {
  recent: 6 * 3600_000, // "recent" goes stale fast
  archive: 7 * 24 * 3600_000,
  both: 7 * 24 * 3600_000,
};

const KIND_PRIORITY: Record<string, number> = { authored: 0, quote: 1, reply: 2, retweet: 3 };

export function isStale(b: Brief): boolean {
  const age = Date.now() - new Date(b.asOf).getTime();
  return age > (TTL_MS[b.window] ?? TTL_MS.both);
}

function rank(tweets: Tweet[], cap = 40): Tweet[] {
  return [...tweets]
    .sort((a, b) => {
      const k = (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9);
      if (k !== 0) return k;
      return String(b.date || "").localeCompare(String(a.date || ""));
    })
    .slice(0, cap);
}

function rowToBrief(r: any): Brief {
  return {
    id: r.id,
    person: r.person,
    topic: r.topic,
    slug: r.slug,
    summaryMd: r.summary_md,
    sources: r.sources || [],
    terms: r.terms || [],
    counts: r.counts || {},
    model: r.model,
    window: r.window,
    asOf: r.as_of,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getBriefBySlug(slug: string): Promise<Brief | null> {
  const { data, error } = await supabaseRead().from("briefs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToBrief(data) : null;
}

export async function listBriefs(limit = 24): Promise<Brief[]> {
  const { data, error } = await supabaseRead()
    .from("briefs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToBrief);
}

export async function listBriefsByPerson(person: string, limit = 50): Promise<Brief[]> {
  const { data, error } = await supabaseRead()
    .from("briefs")
    .select("*")
    .eq("person", normalizeHandle(person))
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(rowToBrief);
}

async function upsertBrief(b: Brief): Promise<Brief> {
  const row = {
    person: b.person,
    topic: b.topic,
    slug: b.slug,
    summary_md: b.summaryMd,
    sources: b.sources,
    terms: b.terms,
    counts: b.counts,
    model: b.model,
    window: b.window,
    as_of: b.asOf,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin()
    .from("briefs")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToBrief(data);
}

export type GenerateResult =
  | { ok: true; brief: Brief; generated: boolean }
  | { ok: false; reason: string; query?: string; notes?: string[] };

export async function getOrGenerateBrief(opts: {
  person: string;
  topic: string;
  window?: BriefWindow;
  force?: boolean;
}): Promise<GenerateResult> {
  const person = normalizeHandle(opts.person);
  const topic = opts.topic.trim();
  const window: BriefWindow = opts.window || "both";
  const slug = briefSlug(person, topic);

  const existing = await getBriefBySlug(slug);
  if (existing && !opts.force && !isStale(existing)) {
    return { ok: true, brief: existing, generated: false };
  }

  assertGenerationEnv();

  const terms = await expandQuery(topic);
  const { tweets, query, notes } = await fetchTweets({ handle: person, terms, token: process.env.X_BEARER_TOKEN!, window });

  if (!tweets.length) {
    // Serve a stale existing brief rather than nothing, if we have one.
    if (existing) return { ok: true, brief: existing, generated: false };
    return { ok: false, reason: "No matching posts for this person and topic.", query, notes };
  }

  const ranked = rank(tweets);
  const counts = ranked.reduce<Record<string, number>>((acc, t) => ((acc[t.kind] = (acc[t.kind] || 0) + 1), acc), {});
  const summaryMd = await synthesize(person, topic, ranked);
  const sources: Source[] = ranked.map((t) => ({ url: t.url, date: t.date, kind: t.kind }));

  const brief: Brief = {
    person,
    topic,
    slug,
    summaryMd,
    sources,
    terms,
    counts,
    model: SYNTHESIS_MODEL,
    window,
    asOf: new Date().toISOString(),
  };

  const saved = await upsertBrief(brief);
  return { ok: true, brief: saved, generated: true };
}
