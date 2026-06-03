// repost engine — X (Twitter) retrieval
//
// Builds a topic-scoped query for one person, fetches matching posts via the
// official X API (the user's own Bearer token — clean BYO-key posture), and
// normalizes each post, labeling authored vs retweet/quote.

const RECENT = "https://api.x.com/2/tweets/search/recent";
const ARCHIVE = "https://api.x.com/2/tweets/search/all";
const MAX_QUERY_LEN = 480; // X query cap is ~512 on most tiers; stay under it

// Build `from:handle (term1 OR "multi word" OR term2)`, capped to MAX_QUERY_LEN.
export function buildQuery({ handle, terms, authoredOnly }) {
  const h = handle.replace(/^@/, "");
  const seen = new Set();
  const quoted = [];
  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    quoted.push(/\s/.test(t) ? `"${t}"` : t);
  }
  const prefix = `from:${h} `;
  const suffix = authoredOnly ? " -is:retweet" : "";
  // Greedily add OR-terms until we'd blow the length budget.
  const picked = [];
  for (const term of quoted) {
    const candidate = `${prefix}(${[...picked, term].join(" OR ")})${suffix}`;
    if (candidate.length > MAX_QUERY_LEN) break;
    picked.push(term);
  }
  if (!picked.length) picked.push(quoted[0] || "");
  return { query: `${prefix}(${picked.join(" OR ")})${suffix}`, usedTerms: picked.length, totalTerms: quoted.length };
}

function classify(tweet) {
  const refs = tweet.referenced_tweets || [];
  if (refs.some((r) => r.type === "retweeted") || /^RT @/.test(tweet.text || "")) return "retweet";
  if (refs.some((r) => r.type === "quoted")) return "quote";
  if (refs.some((r) => r.type === "replied_to")) return "reply";
  return "authored";
}

async function searchPage({ endpoint, query, token, nextToken }) {
  const url = new URL(endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "created_at,referenced_tweets,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");
  if (nextToken) url.searchParams.set("next_token", nextToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  return { status: res.status, body };
}

// Returns { available, tweets[], reason } for one endpoint (recent | archive).
async function searchEndpoint({ endpoint, query, token, maxPages }) {
  const tweets = [];
  let nextToken;
  for (let page = 0; page < maxPages; page++) {
    const { status, body } = await searchPage({ endpoint, query, token, nextToken });
    if (status !== 200) {
      const title = body?.title || body?.errors?.[0]?.title || "";
      const detail = body?.detail || body?.errors?.[0]?.message || "";
      let reason;
      if (status === 401) reason = "401 Unauthorized — bad/expired Bearer token.";
      else if (status === 403) reason = `403 Forbidden — tier not entitled to this endpoint. ${title} ${detail}`.trim();
      else if (status === 429) reason = "429 Rate limited.";
      else reason = `${status} — ${title} ${detail}`.trim();
      return { available: page > 0, tweets, reason };
    }
    const users = new Map((body?.includes?.users || []).map((u) => [u.id, u.username]));
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
  return { available: true, tweets, reason: null };
}

// Fetch topic-scoped posts for a person. window: "recent" | "archive" | "both".
export async function fetchTweets({ handle, terms, token, window = "both", authoredOnly = false, maxPages = 1 }) {
  const { query, usedTerms, totalTerms } = buildQuery({ handle, terms, authoredOnly });

  const wantRecent = window === "recent" || window === "both";
  const wantArchive = window === "archive" || window === "both";

  const results = await Promise.all([
    wantRecent ? searchEndpoint({ endpoint: RECENT, query, token, maxPages }) : null,
    wantArchive ? searchEndpoint({ endpoint: ARCHIVE, query, token, maxPages }) : null,
  ]);

  // Dedupe by id; archive results subsume recent, so a Map keyed by id is enough.
  const byId = new Map();
  const notes = [];
  for (const [label, r] of [["recent", results[0]], ["archive", results[1]]]) {
    if (!r) continue;
    if (r.reason) notes.push(`${label}: ${r.reason}`);
    for (const t of r.tweets) byId.set(t.id, t);
  }

  return { query, usedTerms, totalTerms, tweets: [...byId.values()], notes };
}
