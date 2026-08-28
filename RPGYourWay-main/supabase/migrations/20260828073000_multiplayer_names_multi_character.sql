-- RPG Your Way 1.11.2: session display names + multi-character control.
--
-- multiplayer_seats continues to mean one authenticated HUMAN participant.
-- Character ownership is many-to-one through multiplayer_character_claims so a
-- human can run two, three, or more party characters while every character is
-- still controlled by at most one active participant at a time.

create table if not exists public.multiplayer_character_claims (
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  seat_id uuid not null references public.multiplayer_seats(id) on delete cascade,
  character_id text not null,
  claimed_at timestamptz not null default now(),
  primary key (session_id, character_id),
  unique (seat_id, character_id),
  foreign key (session_id, character_id)
    references public.multiplayer_session_characters(session_id, character_id)
    on delete cascade
);

create index if not exists multiplayer_character_claims_seat_idx
  on public.multiplayer_character_claims (seat_id, claimed_at);

-- Preserve any one-character claims created by 1.11.0/1.11.1 before switching
-- the application to the many-character model.
insert into public.multiplayer_character_claims (session_id, seat_id, character_id)
select session_id, id, character_id
from public.multiplayer_seats
where is_active
  and character_id is not null
on conflict (session_id, character_id) do nothing;

-- The old column remains nullable for rollback compatibility but is no longer
-- authoritative after this migration.
update public.multiplayer_seats
set character_id = null,
    updated_at = now()
where character_id is not null;

alter table public.multiplayer_character_claims enable row level security;

-- Intentionally no browser table policies. Character claims and display-name
-- changes are validated by authenticated RPG Your Way server routes.
