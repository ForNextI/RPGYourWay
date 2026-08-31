-- RPG Your Way: Foundry Integrator Phase 1.
--
-- A Foundry world initiates a short-lived device-style pairing request. An
-- authenticated RPG Your Way member approves that request against one cloud
-- campaign. The resulting connection remains server-authoritative; Foundry
-- never receives Supabase, OpenAI, Stripe, or other server credentials.

create table if not exists public.foundry_connections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  integrator_world_id text not null unique,
  foundry_world_label text,
  controller_foundry_user_id text not null,
  controller_foundry_user_name text,
  linked_by_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (char_length(integrator_world_id) between 8 and 160),
  check (char_length(controller_foundry_user_id) between 1 and 160)
);

create index if not exists foundry_connections_campaign_idx
  on public.foundry_connections (campaign_id, status, updated_at desc);

create index if not exists foundry_connections_linked_user_idx
  on public.foundry_connections (linked_by_user_id, status, updated_at desc);

create table if not exists public.foundry_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  user_code text not null unique,
  integrator_world_id text not null,
  foundry_user_id text not null,
  foundry_user_name text,
  foundry_world_label text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  connection_id uuid references public.foundry_connections(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  session_expires_at timestamptz,
  check (char_length(user_code) between 8 and 16),
  check (char_length(integrator_world_id) between 8 and 160),
  check (char_length(foundry_user_id) between 1 and 160)
);

create index if not exists foundry_pairing_pending_idx
  on public.foundry_pairing_requests (status, expires_at)
  where status = 'pending';

create index if not exists foundry_pairing_world_idx
  on public.foundry_pairing_requests (integrator_world_id, created_at desc);

alter table public.foundry_connections enable row level security;
alter table public.foundry_pairing_requests enable row level security;

-- Intentionally no browser table policies. All access is mediated by RPG Your
-- Way server routes using authenticated users or short-lived signed Foundry
-- integration grants.
