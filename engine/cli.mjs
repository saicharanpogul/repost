#!/usr/bin/env node
// repost — CLI
//
// "What did {person} say about {topic} on X" → sourced context for your agent.
//
// DEFAULT (retrieval-only, no Anthropic key): returns the relevant posts,
// labeled authored/retweet, with dates and source links. Your agent (Claude
// Code, Codex) synthesizes from that. Only your own X bearer token is needed.
//
// --synthesize (needs ANTHROPIC_API_KEY): also writes a transformed, sourced
// prose brief. This is the blog/hosted surface, for humans.
//
// Usage:
//   export X_BEARER_TOKEN="..."                    # required (your own X key)
//   node cli.mjs -p paulg -t "ai agents"
//   node cli.mjs -p paulg -t "ai agents" --terms "agentic,tool use,autonomous agents"
//   node cli.mjs -p paulg -t "ai agents" --window recent --authored-only --json
//   node cli.mjs -p paulg -t "ai agents" --synthesize   # needs ANTHROPIC_API_KEY
//
// Flags:
//   --person, -p     X handle (with or without @)            [required]
//   --topic,  -t     topic to research                       [required]
//   --terms          comma-separated expansion terms (your agent supplies these)
//   --window         recent | archive | both                 [default: both]
//   --authored-only  exclude retweets (person's own words only)
//   --synthesize     also write a prose brief (needs ANTHROPIC_API_KEY)
//   --no-cache       skip the local cache
//   --json           print the full result object as JSON (best for agents)
//
// Requires Node 18+.

import { runEngine } from "./src/engine.mjs";
import { publishBrief } from "./src/publish.mjs";

function parseArgs(argv) {
  const out = { window: "both", authoredOnly: false, synthesize: false, publish: false, useCache: true, json: false, terms: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--person" || a === "-p") out.person = next();
    else if (a === "--topic" || a === "-t") out.topic = next();
    else if (a === "--terms") out.terms = next().split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--window") out.window = next();
    else if (a === "--authored-only") out.authoredOnly = true;
    else if (a === "--synthesize") out.synthesize = true;
    else if (a === "--publish") out.publish = true;
    else if (a === "--no-cache") out.useCache = false;
    else if (a === "--json") out.json = true;
  }
  return out;
}

const C = { dim: "\x1b[2m", red: "\x1b[31m", cyan: "\x1b[36m", bold: "\x1b[1m", reset: "\x1b[0m" };
const err = (m) => console.error(`${C.red}${m}${C.reset}`);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.X_BEARER_TOKEN) return fail("Missing X_BEARER_TOKEN (your own X API bearer token).");
  if (!args.person || !args.topic) return fail("Both --person and --topic are required.");
  if (!["recent", "archive", "both"].includes(args.window)) return fail(`--window must be recent | archive | both (got "${args.window}").`);
  if (args.synthesize && !process.env.ANTHROPIC_API_KEY) return fail("--synthesize needs ANTHROPIC_API_KEY. Drop the flag for retrieval-only (no key needed).");
  if (args.publish && !args.synthesize) return fail("--publish requires --synthesize (you publish a synthesized brief).");
  if (args.publish && !process.env.REPOST_PUBLISH_TOKEN) return fail("--publish needs REPOST_PUBLISH_TOKEN (your contributor token).");

  const result = await runEngine({
    person: args.person,
    topic: args.topic,
    token: process.env.X_BEARER_TOKEN,
    terms: args.terms,
    window: args.window,
    authoredOnly: args.authoredOnly,
    synthesize: args.synthesize,
    useCache: args.useCache,
    onStep: (s) => process.stderr.write(`${C.dim}· ${s}${C.reset}\n`),
  });

  if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }

  if (!result.posts.length) {
    err(result.note || "No posts.");
    if (result.query) console.error(`${C.dim}query: ${result.query}${C.reset}`);
    if (result.notes?.length) console.error(`${C.dim}${result.notes.join("\n")}${C.reset}`);
    process.exitCode = 2;
    return;
  }

  if (result.answer) {
    console.log(result.answer);
    console.log("");
  } else {
    // Retrieval-only: print the structured posts for the agent to reason over.
    console.log(`${C.bold}@${result.person} on "${result.topic}" — ${result.posts.length} posts${C.reset}\n`);
    for (const p of result.posts) {
      const date = (p.date || "undated").slice(0, 10);
      console.log(`${C.dim}${date} · ${p.kind}${C.reset}  ${p.text.replace(/\s+/g, " ").trim()}`);
      console.log(`${C.cyan}${p.url}${C.reset}\n`);
    }
  }

  console.log(`${C.dim}${"─".repeat(60)}${C.reset}`);
  const tag = result.cached ? `${C.cyan}cached${C.reset}` : `fresh · ${result.mode} · ${result.usedTerms}/${result.totalTerms} terms · ${JSON.stringify(result.counts)}`;
  console.log(`${C.dim}${tag}${C.reset}`);
  if (result.notes?.length) console.log(`${C.dim}notes: ${result.notes.join("; ")}${C.reset}`);

  if (args.publish && result.answer) {
    process.stderr.write(`${C.dim}· publishing to corpus${C.reset}\n`);
    try {
      const data = await publishBrief(result, {
        url: process.env.REPOST_PUBLISH_URL || "https://repost.blog",
        token: process.env.REPOST_PUBLISH_TOKEN,
      });
      console.log(`${C.cyan}published:${C.reset} ${data.url}`);
    } catch (e) {
      err(`publish failed: ${e.message}`);
      process.exitCode = 3;
    }
  }
}

function fail(msg) {
  err(msg);
  process.exitCode = 1;
}

main().catch((e) => {
  err(`Engine error: ${e.message}`);
  process.exitCode = 1;
});
