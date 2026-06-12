-- repost — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- A `brief` is the transformed, published synthesis of what one person said
-- about one topic, plus source links and metadata. We store the SUMMARY and
-- SOURCE LINKS only — never raw tweet bodies. This keeps the corpus a
-- commentary layer that cites X, not a tweet redistributor.

create extension if not exists pgcrypto;

create table if not exists public.briefs (
  id          uuid primary key default gen_random_uuid(),
  person      text not null,                 -- normalized handle, no @
  topic       text not null,                 -- original topic phrasing
  slug        text not null unique,          -- "handle/topic-slug"
  summary_md  text not null,                 -- transformed synthesis (markdown)
  sources     jsonb not null default '[]',   -- [{ url, date, kind }]
  terms       jsonb not null default '[]',   -- expansion terms used
  counts      jsonb not null default '{}',   -- { authored, retweet, ... }
  model       text not null,
  window      text not null default 'both',  -- recent | archive | both
  as_of       timestamptz not null,          -- when the underlying data was fetched
  contributed_by text,                        -- authenticated contributor (publish-token label)
  client      text,                           -- publishing client, e.g. 'repost-mcp/0.1.0'
  verified    boolean not null default false, -- sources spot-checked against X (future)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists briefs_person_idx     on public.briefs (person);
create index if not exists briefs_updated_at_idx  on public.briefs (updated_at desc);

-- Row Level Security: anyone may READ published briefs; only the service role
-- (used server-side for generation) may write. The service role bypasses RLS,
-- so we only need the public read policy.
alter table public.briefs enable row level security;

drop policy if exists "briefs are publicly readable" on public.briefs;
create policy "briefs are publicly readable"
  on public.briefs for select
  to anon, authenticated
  using (true);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists briefs_touch_updated_at on public.briefs;
create trigger briefs_touch_updated_at
  before update on public.briefs
  for each row execute function public.touch_updated_at();
