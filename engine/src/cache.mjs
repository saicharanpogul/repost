// repost engine — local synthesis cache
//
// The on-demand + cache architecture in miniature: a fresh (person, topic)
// query is fetched + synthesized once and stored. Re-runs read from disk for
// free. In the hosted product this becomes the shared, demand-weighted corpus;
// locally it's just JSON files under engine/.cache/.
//
// What we store is the TRANSFORMED synthesis + source metadata (author, date,
// link) — never raw tweet bodies. That's the legal guardrail from the design
// doc: cache commentary that cites X, not a tweet redistribution layer.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache");

export function cacheKey(person, topic, mode = "retrieval") {
  return createHash("sha256")
    .update(`${mode}|${person.toLowerCase().replace(/^@/, "")}|${topic.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 16);
}

export function readCache(key) {
  const file = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

export function writeCache(key, value) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}
