-- RPG Your Way: Foundry Integrator player identity links.
--
-- World/controller pairing and individual player identity linking are separate
-- relationships. One RPG Your Way account may legitimately link more than one
-- Foundry user in the same world (for example, one human using a background GM
-- controller client plus a separate Player client for solo play).

create table if not exists public.foundry_user_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.foundry_connections(id) on delete cascade,
  foundry_user_id text not null,
  foundry_user_name text,
  rpg_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (connection_id, foundry_user_id),
  check (char_length(foundry_user_id) between 1 and 160)
);

create index if not exists foundry_user_links_rpg_user_idx
  on public.foundry_user_links (rpg_user_id, status, updated_at desc);

create index if not exists foundry_user_links_connection_idx
  on public.foundry_user_links (connection_id, status, updated_at desc);

create table if not exists public.foundry_player_link_requests (
  id uuid primary key default gen_random_uuid(),
  user_code text not null unique,
  connection_id uuid not null references public.foundry_connections(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  integrator_world_id text not null,
  foundry_user_id text not null,
  foundry_user_name text,
  foundry_world_label text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  player_link_id uuid references public.foundry_user_links(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  session_expires_at timestamptz,
  check (char_length(user_code) between 8 and 16),
  check (char_length(integrator_world_id) between 8 and 160),
  check (char_length(foundry_user_id) between 1 and 160)
);

create index if not exists foundry_player_link_pending_idx
  on public.foundry_player_link_requests (status, expires_at)
  where status = 'pending';

create index if not exists foundry_player_link_user_idx
  on public.foundry_player_link_requests (
    connection_id,
    foundry_user_id,
    created_at desc
  );

alter table public.foundry_user_links enable row level security;
alter table public.foundry_player_link_requests enable row level security;

-- Intentionally no browser table policies. Player-link creation, approval,
-- grant issuance, and reads are mediated by server routes.
