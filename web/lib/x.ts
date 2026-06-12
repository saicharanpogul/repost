// Server-side X retrieval (hosted operator's key). Builds a topic-scoped query
// for one person, fetches recent + full-archive, and labels authored vs
// retweet/quote. Mirrors engine/src/x-client.mjs.

const RECENT = "https://api.x.com/2/tweets/search/recent";
const ARCHIVE = "https://api.x.com/2/tweets/search/all";
const MAX_QUERY_LEN = 480;

export type Tweet = { id: string; text: string; date: string | null; kind: string; url: string };

export function buildQuery(handle: string, terms: string[]): { query: string; usedTerms: number; totalTerms: number } {
  const h = handle.replace(/^@/, "");
  const seen = new Set<string>();
  const quoted: string[] = [];
  for (const raw of terms) {
    const t = (raw || "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    quoted.push(/\s/.test(t) ? `"${t}"` : t);
  }
  const prefix = `from:${h} `;
  const picked: string[] = [];
  for (const term of quoted) {
    const candidate = `${prefix}(${[...picked, term].join(" OR ")})`;
    if (candidate.length > MAX_QUERY_LEN) break;
    picked.push(term);
  }
  if (!picked.length) picked.push(quoted[0] || "");
  return { query: `${prefix}(${picked.join(" OR ")})`, usedTerms: picked.length, totalTerms: quoted.length };
}

function classify(t: { text?: string; referenced_tweets?: { type: string }[] }): string {
  const refs = t.referenced_tweets || [];
  if (refs.some((r) => r.type === "retweeted") || /^RT @/.test(t.text || "")) return "retweet";
  if (refs.some((r) => r.type === "quoted")) return "quote";
  if (refs.some((r) => r.type === "replied_to")) return "reply";
  return "authored";
}

async function searchPage(endpoint: string, query: string, token: string, nextToken?: string) {
  const url = new URL(endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "created_at,referenced_tweets,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");
  if (nextToken) url.searchParams.set("next_token", nextToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

async function searchEndpoint(endpoint: string, query: string, token: string, maxPages: number) {
  const tweets: Tweet[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { status, body } = await searchPage(endpoint, query, token, nextToken);
    if (status !== 200) {
      const title = body?.title || body?.errors?.[0]?.title || "";
      const detail = body?.detail || body?.errors?.[0]?.message || "";
      let reason: string;
      if (status === 401) reason = "401 Unauthorized — bad/expired Bearer token.";
      else if (status === 403) reason = `403 Forbidden — tier not entitled. ${title} ${detail}`.trim();
      else if (status === 429) reason = "429 Rate limited.";
      else reason = `${status} — ${title} ${detail}`.trim();
      return { tweets, reason };
    }
    const users = new Map<string, string>((body?.includes?.users || []).map((u: any) => [u.id, u.username]));
    for (const t of body?.data || []) {
      const username = users.get(t.author_id);
      tweets.push({
        id: t.id,
        text: t.text || "",
        date: t.created_at || null,
        kind: classify(t),
        url: `https://x.com/${username || "i/web"}/status/${t.id}`,
      });
    }
    nextToken = body?.meta?.next_token;
    if (!nextToken) break;
  }
  return { tweets, reason: null as string | null };
}

export async function fetchTweets(opts: {
  handle: string;
  terms: string[];
  token: string;
  window?: "recent" | "archive" | "both";
  maxPages?: number;
}) {
  const { handle, terms, token, window = "both", maxPages = 1 } = opts;
  const { query, usedTerms, totalTerms } = buildQuery(handle, terms);

  const tasks: Promise<{ tweets: Tweet[]; reason: string | null }>[] = [];
  const labels: string[] = [];
  if (window === "recent" || window === "both") { tasks.push(searchEndpoint(RECENT, query, token, maxPages)); labels.push("recent"); }
  if (window === "archive" || window === "both") { tasks.push(searchEndpoint(ARCHIVE, query, token, maxPages)); labels.push("archive"); }

  const results = await Promise.all(tasks);
  const byId = new Map<string, Tweet>();
  const notes: string[] = [];
  results.forEach((r, i) => {
    if (r.reason) notes.push(`${labels[i]}: ${r.reason}`);
    for (const t of r.tweets) byId.set(t.id, t);
  });

  return { query, usedTerms, totalTerms, tweets: [...byId.values()], notes };
}
