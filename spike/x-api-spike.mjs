#!/usr/bin/env node
// repost — X API spike
//
// Question this answers (from the office-hours design doc):
//   Can a BYO X API key pull TOPIC-SCOPED tweets for one person, and...
//     1. Does RECENT search (~last 7 days) work on your tier?
//     2. Does FULL-ARCHIVE search (historical "over time") work, or is it gated?
//     3. How many tweets does a real topic query return?
//     4. What does that cost at pay-per-use ($0.005 / post read)?
//
// This is a VALIDATION instrument, not the product. It decides whether the
// on-demand architecture is viable and which version of "context" ships day one.
//
// Usage:
//   export X_BEARER_TOKEN="<your app-only bearer token>"
//   node spike/x-api-spike.mjs
//   node spike/x-api-spike.mjs 'from:paulg ("ai agents" OR agents)'   # custom query
//
// Env knobs:
//   MAX_PAGES=2   how many 100-result pages to pull per endpoint (default 1, keeps cost low)
//
// Requires Node 18+ (global fetch).

const TOKEN = process.env.X_BEARER_TOKEN;
const PRICE_PER_READ = 0.005; // USD, pay-per-use post read (2026)
const MONTHLY_CAP_READS = 2_000_000;
const MAX_PAGES = Math.max(1, parseInt(process.env.MAX_PAGES || "1", 10));

const DEFAULT_QUERY = 'from:paulg ("ai agents" OR "AI agents" OR agents)';
const QUERY = process.argv.slice(2).join(" ").trim() || DEFAULT_QUERY;

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const log = (s = "") => console.log(s);
const hr = () => log(C.dim + "─".repeat(64) + C.reset);

if (!TOKEN) {
  log(`${C.red}${C.bold}No X_BEARER_TOKEN found.${C.reset}`);
  log("");
  log("Set an app-only Bearer token from your X developer app and re-run:");
  log(`  ${C.cyan}export X_BEARER_TOKEN="AAAA..."${C.reset}`);
  log(`  ${C.cyan}node spike/x-api-spike.mjs${C.reset}`);
  log("");
  log(`${C.dim}Get one at https://developer.x.com → your app → Keys and tokens → Bearer Token${C.reset}`);
  process.exit(1);
}

const ENDPOINTS = {
  recent: "https://api.x.com/2/tweets/search/recent",
  archive: "https://api.x.com/2/tweets/search/all",
};

async function searchPage(kind, nextToken) {
  const url = new URL(ENDPOINTS[kind]);
  url.searchParams.set("query", QUERY);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "created_at");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username");
  if (nextToken) url.searchParams.set("next_token", nextToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error */ }
  return { status: res.status, body };
}

// Pull up to MAX_PAGES pages; return {available, tweets[], oldest, newest, reason}
async function runEndpoint(kind) {
  const tweets = [];
  let nextToken = undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { status, body } = await searchPage(kind, nextToken);

    if (status === 200) {
      const data = (body && body.data) || [];
      tweets.push(...data);
      nextToken = body?.meta?.next_token;
      if (!nextToken) break;
      continue;
    }

    // Non-200: classify the failure
    const title = body?.title || body?.errors?.[0]?.title || "";
    const detail = body?.detail || body?.errors?.[0]?.message || "";
    let reason;
    if (status === 401) reason = "401 Unauthorized — bad/expired Bearer token.";
    else if (status === 403) reason = `403 Forbidden — your tier is not entitled to ${kind === "archive" ? "full-archive search" : "this endpoint"}. (${title} ${detail})`.trim();
    else if (status === 429) reason = "429 Rate limited — hit a rate cap. Try again shortly or reduce MAX_PAGES.";
    else reason = `${status} — ${title} ${detail}`.trim();
    return { available: page > 0, tweets, reason, partial: page > 0 };
  }

  return { available: true, tweets, reason: null };
}

function summarize(tweets) {
  if (!tweets.length) return { count: 0, oldest: null, newest: null };
  const dates = tweets.map((t) => t.created_at).filter(Boolean).sort();
  return { count: tweets.length, oldest: dates[0] || null, newest: dates[dates.length - 1] || null };
}

function usd(n) { return `$${n.toFixed(3)}`; }

(async () => {
  hr();
  log(`${C.bold}repost — X API spike${C.reset}`);
  log(`${C.dim}query:${C.reset} ${QUERY}`);
  log(`${C.dim}pages/endpoint:${C.reset} ${MAX_PAGES} (≤${MAX_PAGES * 100} reads each)`);
  hr();

  // 1) Recent search
  log(`${C.bold}1) RECENT search${C.reset} ${C.dim}(/2/tweets/search/recent, ~last 7 days)${C.reset}`);
  const recent = await runEndpoint("recent");
  const rs = summarize(recent.tweets);
  if (recent.available || recent.tweets.length) {
    log(`   ${C.green}✓ works${C.reset} — ${rs.count} tweet(s) for this query`);
    if (rs.oldest) log(`   ${C.dim}window: ${rs.oldest} → ${rs.newest}${C.reset}`);
    if (recent.tweets[0]) log(`   ${C.dim}sample: "${(recent.tweets[0].text || "").slice(0, 90).replace(/\n/g, " ")}…"${C.reset}`);
  } else {
    log(`   ${C.red}✗ ${recent.reason}${C.reset}`);
  }
  log("");

  // 2) Full-archive search
  log(`${C.bold}2) FULL-ARCHIVE search${C.reset} ${C.dim}(/2/tweets/search/all, all history)${C.reset}`);
  const archive = await runEndpoint("archive");
  const as = summarize(archive.tweets);
  let archiveOk = false;
  if (archive.available && (archive.tweets.length || archive.reason === null)) {
    archiveOk = true;
    log(`   ${C.green}✓ works${C.reset} — ${as.count} tweet(s) for this query`);
    if (as.oldest) log(`   ${C.dim}window: ${as.oldest} → ${as.newest}${C.reset}`);
  } else {
    log(`   ${C.red}✗ ${archive.reason}${C.reset}`);
    log(`   ${C.dim}If 403: historical "over time" context needs a higher tier. Day-1 ships RECENT-only.${C.reset}`);
  }
  log("");

  // 3 + 4) Volume + cost
  const totalReads = rs.count + as.count;
  const oneQueryReads = Math.max(rs.count, as.count); // a single user query ≈ one endpoint
  hr();
  log(`${C.bold}3) VOLUME${C.reset} — this spike read ${totalReads} post(s) total`);
  log(`${C.bold}4) COST${C.reset} at ${usd(PRICE_PER_READ)}/read:`);
  log(`   this spike run:            ${C.cyan}${usd(totalReads * PRICE_PER_READ)}${C.reset}`);
  log(`   one on-demand user query:  ${C.cyan}~${usd(oneQueryReads * PRICE_PER_READ)}${C.reset} ${C.dim}(${oneQueryReads} reads, then cached forever)${C.reset}`);
  if (oneQueryReads > 0) {
    const queriesToCap = Math.floor(MONTHLY_CAP_READS / oneQueryReads);
    log(`   ${C.dim}2M-read/mo cap ≈ ${queriesToCap.toLocaleString()} fresh queries/month before the cap${C.reset}`);
  }
  hr();

  // Verdict
  const recentOk = recent.tweets.length > 0 || recent.available;
  log(`${C.bold}VERDICT${C.reset}`);
  if (recentOk && archiveOk) {
    log(`   ${C.green}Both recent + archive work.${C.reset} On-demand can ship FULL "over time" context day one.`);
  } else if (recentOk) {
    log(`   ${C.yellow}Recent works, archive does not.${C.reset} Ship RECENT-only context day one;`);
    log(`   historical depth requires a higher tier OR builds up slowly via the cache.`);
  } else {
    log(`   ${C.red}Recent search did not return.${C.reset} Fix the token/tier before trusting any demand test.`);
  }
  log("");
  log(`${C.dim}Next: paste this output back into the repost session to update the design doc's${C.reset}`);
  log(`${C.dim}"OPEN TECHNICAL RISK" line with the real answer.${C.reset}`);
  hr();
})().catch((err) => {
  log(`${C.red}Spike crashed: ${err.message}${C.reset}`);
  log(`${C.dim}If this is a TLS/network error, check connectivity. If "fetch is not defined", you need Node 18+.${C.reset}`);
  process.exit(1);
});
