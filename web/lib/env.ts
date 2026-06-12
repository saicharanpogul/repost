// Server-side env for the READ-ONLY site.
//
// The website never fetches X or calls an LLM — generation happens on clients
// (the MCP / engine, BYO-key). So there is NO X_BEARER_TOKEN and NO
// ANTHROPIC_API_KEY here. The server only needs:
//   - Supabase (read via anon, write via service role on /api/contribute)
//   - an allowlist of publish tokens for contributors

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://repost.blog",
};

export function hasSupabase() {
  return Boolean(env.supabaseUrl && (env.supabaseServiceKey || env.supabaseAnonKey));
}

// Contributor allowlist. Format: "alice:secret1,bob:secret2" (label:token).
// A bare token with no label maps to "contributor". Returns token -> label.
export function publishTokens(): Map<string, string> {
  const raw = process.env.REPOST_PUBLISH_TOKENS || "";
  const map = new Map<string, string>();
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    const idx = s.indexOf(":");
    if (idx > 0) {
      const label = s.slice(0, idx).trim();
      const tok = s.slice(idx + 1).trim();
      if (tok) map.set(tok, label || "contributor");
    } else {
      map.set(s, "contributor");
    }
  }
  return map;
}

// Returns the contributor label for a token, or null if not allowlisted.
export function labelForToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return publishTokens().get(token) ?? null;
}
