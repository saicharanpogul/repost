// Brief data access for the READ-ONLY site, plus the validated write path used
// by /api/contribute (clients publish briefs they generated locally).
//
// The server never generates a brief. It stores what allowlisted contributors
// publish, after validation.

import { supabaseAdmin, supabaseRead } from "./supabase";
import { briefSlug, normalizeHandle } from "./slug";
import type { Brief, BriefWindow, Source } from "./types";

const TTL_MS: Record<BriefWindow, number> = {
  recent: 6 * 3600_000,
  archive: 7 * 24 * 3600_000,
  both: 7 * 24 * 3600_000,
};

const KINDS = new Set(["authored", "retweet", "quote", "reply"]);

export function isStale(b: Brief): boolean {
  const age = Date.now() - new Date(b.asOf).getTime();
  return age > (TTL_MS[b.window] ?? TTL_MS.both);
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
    contributedBy: r.contributed_by,
    client: r.client,
    verified: r.verified,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---- Reads (public) ----

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

// ---- Write (validated, via /api/contribute) ----

export type Contribution = {
  person: string;
  topic: string;
  summary_md: string;
  sources: Source[];
  terms?: string[];
  counts?: Record<string, number>;
  model?: string;
  window?: string;
  as_of?: string;
};

export class ValidationError extends Error {}

const MAX_SUMMARY = 24000;
const MAX_SOURCES = 200;

function validate(c: Contribution): {
  person: string;
  topic: string;
  slug: string;
  summaryMd: string;
  sources: Source[];
  window: BriefWindow;
} {
  const person = normalizeHandle(c.person || "");
  const topic = (c.topic || "").trim();
  const summaryMd = (c.summary_md || "").trim();

  if (!person) throw new ValidationError("person is required");
  if (!topic) throw new ValidationError("topic is required");
  if (!summaryMd) throw new ValidationError("summary_md is required");
  if (summaryMd.length > MAX_SUMMARY) throw new ValidationError("summary_md too long");

  if (!Array.isArray(c.sources) || c.sources.length === 0) {
    throw new ValidationError("at least one source is required");
  }
  if (c.sources.length > MAX_SOURCES) throw new ValidationError("too many sources");

  // Every source must be a real X status link — keeps this a commentary layer
  // that cites X, and makes claims checkable.
  const sources: Source[] = c.sources.map((s, i) => {
    const url = String(s?.url || "");
    if (!/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(url) && !/^https:\/\/x\.com\/i\/web\/status\/\d+/.test(url)) {
      throw new ValidationError(`source[${i}].url must be an x.com status link`);
    }
    const kind = KINDS.has(String(s?.kind)) ? String(s.kind) : "authored";
    const date = s?.date ? String(s.date) : null;
    return { url, kind, date };
  });

  const window: BriefWindow = c.window === "recent" || c.window === "archive" ? c.window : "both";
  return { person, topic, slug: briefSlug(person, topic), summaryMd, sources, window };
}

export async function createBriefFromContribution(
  c: Contribution,
  contributedBy: string,
  client: string,
): Promise<Brief> {
  const v = validate(c);
  const counts =
    c.counts && typeof c.counts === "object"
      ? c.counts
      : v.sources.reduce<Record<string, number>>((acc, s) => ((acc[s.kind] = (acc[s.kind] || 0) + 1), acc), {});

  const row = {
    person: v.person,
    topic: v.topic,
    slug: v.slug,
    summary_md: v.summaryMd,
    sources: v.sources,
    terms: Array.isArray(c.terms) ? c.terms : [],
    counts,
    model: (c.model || "client").slice(0, 80),
    window: v.window,
    as_of: c.as_of && !Number.isNaN(Date.parse(c.as_of)) ? new Date(c.as_of).toISOString() : new Date().toISOString(),
    contributed_by: contributedBy,
    client: (client || "unknown").slice(0, 80),
    verified: false, // sources not yet machine-checked against X (see roadmap)
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
