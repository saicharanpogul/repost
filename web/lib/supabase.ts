import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client for writes (server-only — bypasses RLS).
export function supabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Supabase admin not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
}

// Read client. Uses the anon key (public SELECT via RLS); falls back to the
// service key if no anon key is set. Server-side only.
export function supabaseRead(): SupabaseClient {
  const key = env.supabaseAnonKey || env.supabaseServiceKey;
  if (!env.supabaseUrl || !key) {
    throw new Error("Supabase read client not configured.");
  }
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false } });
}
