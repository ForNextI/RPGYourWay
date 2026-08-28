-- RPG Your Way 1.12.0: canonical cloud campaigns.
--
-- Campaign state moves from browser-only persistence to one authenticated cloud
-- record. Browser IndexedDB remains a cache and legacy-import bridge. Multiplayer
-- membership will build on campaign_members rather than on one player's browser.

create table if not exists public.campaigns (
  id uuid primary key,
  created_by_user_id uuid references auth.users(id) on delete set null,
  mode text not null default 'solo' check (mode in ('solo', 'multiplayer')),
  name text not null,
  stage text not null default 'complete' check (stage in ('party', 'calibration', 'complete')),
  party_names text[] not null default '{}',
  state jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(name) between 1 and 160)
);

create index if not exists campaigns_updated_idx
  on public.campaigns (updated_at desc)
  where deleted_at is null;
create index if not exists campaigns_creator_idx
  on public.campaigns (created_by_user_id, updated_at desc)
  where deleted_at is null;

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index if not exists campaign_members_user_active_idx
  on public.campaign_members (user_id, last_opened_at desc)
  where membership_status = 'active';

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

-- Intentionally no browser table policies. Authenticated RPG Your Way server
-- routes verify membership and use the service-role client for canonical reads
-- and revision-checked writes.
