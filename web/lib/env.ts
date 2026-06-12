// Server-side env. NEXT_PUBLIC_* are safe in the browser; the rest are server-only
// (service role key, X token, Anthropic key) and must never be imported into a
// client component.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  xToken: process.env.X_BEARER_TOKEN || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://repost.blog",
};

export function hasSupabase() {
  return Boolean(env.supabaseUrl && (env.supabaseServiceKey || env.supabaseAnonKey));
}

// Generation (fetch + synthesize + write) needs all of these.
export function assertGenerationEnv() {
  const missing: string[] = [];
  if (!env.xToken) missing.push("X_BEARER_TOKEN");
  if (!env.anthropicKey) missing.push("ANTHROPIC_API_KEY");
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    throw new Error(`Generation is not configured. Missing env: ${missing.join(", ")}.`);
  }
}
