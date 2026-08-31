-- RPG Your Way: Foundry character mapping and structured token-state bridge.
--
-- These tables deliberately store identifiers and structured game state only.
-- They do not contain Foundry maps, artwork, journals, compendia, or billing state.

create table if not exists public.foundry_character_mappings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.foundry_connections(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_character_id text not null,
  foundry_actor_id text not null,
  mapped_by_foundry_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, campaign_character_id),
  unique (connection_id, foundry_actor_id),
  check (char_length(campaign_character_id) between 1 and 180),
  check (char_length(foundry_actor_id) between 1 and 180)
);

create index if not exists foundry_character_mappings_campaign_idx
  on public.foundry_character_mappings (campaign_id, updated_at desc);

create table if not exists public.foundry_token_state (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.foundry_connections(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  campaign_character_id text not null,
  foundry_actor_id text not null,
  foundry_token_id text not null,
  scene_id text not null,
  x double precision not null check (x >= 0),
  y double precision not null check (y >= 0),
  source_foundry_user_id text,
  last_event_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, campaign_character_id),
  check (char_length(campaign_character_id) between 1 and 180),
  check (char_length(foundry_actor_id) between 1 and 180),
  check (char_length(foundry_token_id) between 1 and 180),
  check (char_length(scene_id) between 1 and 180)
);

create index if not exists foundry_token_state_campaign_idx
  on public.foundry_token_state (campaign_id, updated_at desc);

alter table public.foundry_character_mappings enable row level security;
alter table public.foundry_token_state enable row level security;

-- Intentionally no browser table policies. Mapping and state synchronization
-- are mediated by scoped Foundry controller routes.
