-- RPG Your Way 1.12.73: multiplayer campaign governance.
--
-- Multiplayer campaign administration lives with the persistent cloud campaign,
-- not with an individual browser or a temporary chat session. Shared Control is
-- collective; Coordinator Control delegates housekeeping to one member.

alter table public.campaigns
  add column if not exists administration_mode text,
  add column if not exists coordinator_user_id uuid references auth.users(id) on delete set null,
  add column if not exists purge_after timestamptz;

update public.campaigns
set administration_mode = case when mode = 'multiplayer' then 'coordinator' else 'solo' end
where administration_mode is null;

alter table public.campaigns
  alter column administration_mode set default 'solo',
  alter column administration_mode set not null;

alter table public.campaigns
  drop constraint if exists campaigns_administration_mode_check;
alter table public.campaigns
  add constraint campaigns_administration_mode_check
  check (administration_mode in ('solo', 'shared', 'coordinator'));

update public.campaigns
set coordinator_user_id = created_by_user_id
where mode = 'multiplayer'
  and administration_mode = 'coordinator'
  and coordinator_user_id is null;

alter table public.campaign_members
  add column if not exists display_name text not null default 'Player';

alter table public.campaign_members
  drop constraint if exists campaign_members_display_name_check;
alter table public.campaign_members
  add constraint campaign_members_display_name_check
  check (char_length(display_name) between 1 and 48);

create table if not exists public.campaign_governance_proposals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  proposal_type text not null check (proposal_type in ('remove_member', 'delete_campaign')),
  target_user_id uuid references auth.users(id) on delete cascade,
  proposed_by_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'executed', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((proposal_type = 'remove_member' and target_user_id is not null) or (proposal_type = 'delete_campaign' and target_user_id is null))
);

create unique index if not exists campaign_governance_one_open_delete_idx
  on public.campaign_governance_proposals (campaign_id)
  where status = 'open' and proposal_type = 'delete_campaign';

create unique index if not exists campaign_governance_one_open_remove_idx
  on public.campaign_governance_proposals (campaign_id, target_user_id)
  where status = 'open' and proposal_type = 'remove_member';

create table if not exists public.campaign_governance_votes (
  proposal_id uuid not null references public.campaign_governance_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('approve', 'oppose')),
  voted_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create index if not exists campaign_governance_open_idx
  on public.campaign_governance_proposals (campaign_id, created_at desc)
  where status = 'open';

alter table public.campaign_governance_proposals enable row level security;
alter table public.campaign_governance_votes enable row level security;

-- Multiplayer rooms are transient transport/session objects, but new rooms are
-- now attached to the canonical cloud campaign so joining a room can establish
-- persistent campaign membership. Existing private-test rooms may remain null.
alter table public.multiplayer_sessions
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade;

create index if not exists multiplayer_sessions_campaign_status_idx
  on public.multiplayer_sessions (campaign_id, status, created_at desc)
  where campaign_id is not null;
