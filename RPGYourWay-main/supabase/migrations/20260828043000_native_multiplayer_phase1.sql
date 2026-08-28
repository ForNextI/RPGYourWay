-- RPG Your Way 1.11.0: native multiplayer Phase 1.
--
-- The database owns multiplayer room membership and character-seat claims.
-- Ably is transport only. Browser clients have no direct table policies; all
-- reads and writes go through authenticated RPG Your Way server routes.

create table if not exists public.multiplayer_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  campaign_fingerprint text not null,
  campaign_name text not null,
  coordinator_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'closed')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(invite_code) between 20 and 96),
  check (char_length(campaign_fingerprint) between 32 and 128),
  check (char_length(campaign_name) between 1 and 120)
);

create index if not exists multiplayer_sessions_coordinator_status_idx
  on public.multiplayer_sessions (coordinator_user_id, status, created_at desc);
create index if not exists multiplayer_sessions_expiry_idx
  on public.multiplayer_sessions (expires_at)
  where status <> 'closed';

create table if not exists public.multiplayer_session_characters (
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  character_id text not null,
  display_name text not null,
  ordinal integer not null default 0 check (ordinal between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (session_id, character_id),
  check (char_length(character_id) between 1 and 160),
  check (char_length(display_name) between 1 and 96)
);

create table if not exists public.multiplayer_seats (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  payer_user_id uuid not null references auth.users(id) on delete cascade,
  character_id text,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(display_name) between 1 and 48),
  foreign key (session_id, character_id)
    references public.multiplayer_session_characters(session_id, character_id)
    on delete no action
);

create unique index if not exists multiplayer_seats_active_user_idx
  on public.multiplayer_seats (session_id, user_id)
  where is_active;
create unique index if not exists multiplayer_seats_active_character_idx
  on public.multiplayer_seats (session_id, character_id)
  where is_active and character_id is not null;
create index if not exists multiplayer_seats_session_joined_idx
  on public.multiplayer_seats (session_id, joined_at)
  where is_active;

create or replace function public.rpgyw_multiplayer_enforce_seat_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_active_count integer;
begin
  if new.is_active is not true then
    return new;
  end if;

  perform 1
  from public.multiplayer_sessions
  where id = new.session_id
  for update;

  select count(*)
  into v_active_count
  from public.multiplayer_seats
  where session_id = new.session_id
    and is_active
    and id <> new.id;

  if v_active_count >= 6 then
    raise exception 'Multiplayer table already has six active seats';
  end if;

  return new;
end;
$$;

drop trigger if exists multiplayer_seat_limit_trigger on public.multiplayer_seats;
create trigger multiplayer_seat_limit_trigger
before insert or update of session_id, is_active
on public.multiplayer_seats
for each row
execute function public.rpgyw_multiplayer_enforce_seat_limit();

alter table public.multiplayer_sessions enable row level security;
alter table public.multiplayer_session_characters enable row level security;
alter table public.multiplayer_seats enable row level security;

-- Intentionally no browser table policies. The service-role-backed RPG Your Way
-- API checks authenticated room membership before returning or changing room data.
