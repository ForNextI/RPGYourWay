-- RPG Your Way 2.8.0: Foundry combat handoff.
--
-- RPG Your Way stores only a compact structured encounter request and the
-- resulting Foundry Scene ID. Local maps, token artwork, compendia, journals,
-- walls, lighting, and other third-party Foundry content remain local.

alter table public.foundry_connections
  add column if not exists launch_url text;

create table if not exists public.foundry_combat_encounters (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.foundry_connections(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  turn_number bigint not null default 0 check (turn_number >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'rendered', 'failed')),
  payload jsonb not null,
  foundry_scene_id text,
  error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  rendered_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (connection_id, turn_number),
  check (jsonb_typeof(payload) = 'object'),
  check (foundry_scene_id is null or char_length(foundry_scene_id) between 1 and 180),
  check (error_message is null or char_length(error_message) <= 1000)
);

create index if not exists foundry_combat_encounters_open_idx
  on public.foundry_combat_encounters (connection_id, status, created_at)
  where status in ('pending', 'claimed');

create index if not exists foundry_combat_encounters_campaign_idx
  on public.foundry_combat_encounters (campaign_id, created_at desc);

alter table public.foundry_combat_encounters enable row level security;

-- Intentionally no browser table policies. Web access is mediated by
-- authenticated RPG Your Way routes; Foundry access requires the scoped
-- controller session grant.
