-- RPG Your Way 1.12.74: public multiplayer turn safety and split billing.
--
-- One campaign may have only one state-mutating AI turn in flight at a time.
-- The server freezes the participating seat/payer roster at call start, reserves
-- every payer's maximum share before the provider call, and settles the final
-- rounded whole-turn charge across those frozen seats.

alter table public.multiplayer_seats
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists multiplayer_seats_last_seen_idx
  on public.multiplayer_seats (session_id, last_seen_at desc)
  where is_active;

-- A canonical cloud campaign has one open realtime table. Close older duplicate
-- rooms left by private testing before enforcing that invariant.
with ranked_open_sessions as (
  select id,
         row_number() over (partition by campaign_id order by created_at desc, id desc) as position
  from public.multiplayer_sessions
  where campaign_id is not null and status <> 'closed'
)
update public.multiplayer_sessions as sessions
set status = 'closed', updated_at = now()
from ranked_open_sessions as ranked
where sessions.id = ranked.id and ranked.position > 1;

create unique index if not exists multiplayer_sessions_one_open_per_campaign_idx
  on public.multiplayer_sessions (campaign_id)
  where campaign_id is not null and status <> 'closed';

create table if not exists public.multiplayer_turns (
  id uuid primary key,
  session_id uuid not null references public.multiplayer_sessions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  expected_campaign_revision bigint not null check (expected_campaign_revision >= 1),
  committed_campaign_revision bigint,
  turn_status text not null default 'pending' check (turn_status in ('pending', 'held', 'ai_complete', 'committed', 'released', 'failed')),
  billing_status text not null default 'pending' check (billing_status in ('pending', 'held', 'settled', 'released', 'error')),
  seat_snapshot jsonb not null default '[]'::jsonb,
  maximum_total_microusd bigint not null default 0 check (maximum_total_microusd >= 0),
  provider_total_microusd bigint not null default 0 check (provider_total_microusd >= 0),
  billed_total_microusd bigint not null default 0 check (billed_total_microusd >= 0),
  ttt_provider_microusd bigint not null default 0 check (ttt_provider_microusd >= 0),
  gameplay_provider_microusd bigint not null default 0 check (gameplay_provider_microusd >= 0),
  tts_provider_microusd bigint not null default 0 check (tts_provider_microusd >= 0),
  settlement_warning text,
  lease_expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists multiplayer_turns_campaign_created_idx
  on public.multiplayer_turns (campaign_id, created_at desc);
create index if not exists multiplayer_turns_session_created_idx
  on public.multiplayer_turns (session_id, created_at desc);

create unique index if not exists multiplayer_turns_one_live_per_campaign_idx
  on public.multiplayer_turns (campaign_id)
  where turn_status in ('pending', 'held', 'ai_complete');

create table if not exists public.multiplayer_turn_charges (
  turn_id uuid not null references public.multiplayer_turns(id) on delete cascade,
  payer_user_id uuid not null references auth.users(id) on delete cascade,
  seat_count integer not null check (seat_count >= 1 and seat_count <= 6),
  maximum_microusd bigint not null default 0 check (maximum_microusd >= 0),
  usage_hold_id uuid references public.usage_holds(id) on delete set null,
  owner_qa_exempt boolean not null default false,
  billed_microusd bigint not null default 0 check (billed_microusd >= 0),
  ttt_billed_microusd bigint not null default 0 check (ttt_billed_microusd >= 0),
  gameplay_billed_microusd bigint not null default 0 check (gameplay_billed_microusd >= 0),
  tts_billed_microusd bigint not null default 0 check (tts_billed_microusd >= 0),
  balance_after_microusd bigint,
  status text not null default 'pending' check (status in ('pending', 'held', 'settled', 'released', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (turn_id, payer_user_id)
);

create index if not exists multiplayer_turn_charges_payer_idx
  on public.multiplayer_turn_charges (payer_user_id, created_at desc);

alter table public.multiplayer_turns enable row level security;
alter table public.multiplayer_turn_charges enable row level security;
-- No browser policies. These rows are private billing/serialization machinery.

alter table public.play_turn_billing
  add column if not exists multiplayer_turn_id uuid references public.multiplayer_turns(id) on delete set null;

create index if not exists play_turn_billing_multiplayer_turn_idx
  on public.play_turn_billing (multiplayer_turn_id)
  where multiplayer_turn_id is not null;

-- Atomically claim the campaign's one state-mutating AI turn slot. The service
-- role calls this only after authenticating the human and validating membership.
create or replace function public.rpgyw_begin_multiplayer_turn(
  p_turn_id uuid,
  p_session_id uuid,
  p_campaign_id uuid,
  p_submitter_user_id uuid,
  p_expected_revision bigint,
  p_lease_expires_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_revision bigint;
  v_existing public.multiplayer_turns%rowtype;
begin
  select revision into v_revision
  from public.campaigns
  where id = p_campaign_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'MULTIPLAYER_CAMPAIGN_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.multiplayer_sessions
    where id = p_session_id
      and campaign_id = p_campaign_id
      and status <> 'closed'
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'MULTIPLAYER_SESSION_NOT_AVAILABLE';
  end if;

  update public.multiplayer_turns
  set turn_status = 'released',
      billing_status = case when billing_status = 'pending' then 'released' else billing_status end,
      settlement_warning = coalesce(settlement_warning, 'Turn lease expired before completion.'),
      updated_at = now()
  where campaign_id = p_campaign_id
    and turn_status in ('pending', 'held', 'ai_complete')
    and lease_expires_at <= now();

  select * into v_existing
  from public.multiplayer_turns
  where id = p_turn_id;

  if found then
    if v_existing.session_id <> p_session_id
      or v_existing.campaign_id <> p_campaign_id
      or v_existing.submitted_by_user_id <> p_submitter_user_id then
      raise exception 'MULTIPLAYER_TURN_ID_REUSED';
    end if;
    return v_revision;
  end if;

  if v_revision <> p_expected_revision then
    raise exception 'MULTIPLAYER_REVISION_CONFLICT:%', v_revision;
  end if;

  if exists (
    select 1 from public.multiplayer_turns
    where campaign_id = p_campaign_id
      and turn_status in ('pending', 'held', 'ai_complete')
  ) then
    raise exception 'MULTIPLAYER_TURN_IN_PROGRESS';
  end if;

  insert into public.multiplayer_turns (
    id, session_id, campaign_id, submitted_by_user_id,
    expected_campaign_revision, lease_expires_at
  ) values (
    p_turn_id, p_session_id, p_campaign_id, p_submitter_user_id,
    p_expected_revision, p_lease_expires_at
  );

  return v_revision;
end;
$$;

-- Service-role variants of the existing wallet hold functions. Browser users
-- never receive EXECUTE on these because the multiplayer server must reserve and
-- capture several different payer accounts inside one shared turn.
create or replace function public.rpgyw_reserve_usage_for_user(
  p_user_id uuid,
  p_maximum_microusd bigint,
  p_source text,
  p_source_ref text,
  p_idempotency_key text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_wallet public.usage_wallets%rowtype;
  v_existing public.usage_holds%rowtype;
  v_expired_reserved bigint := 0;
  v_hold_id uuid;
begin
  if p_user_id is null then raise exception 'Payer is required'; end if;
  if p_maximum_microusd is null or p_maximum_microusd <= 0 then raise exception 'Maximum usage must be positive'; end if;

  select * into v_existing from public.usage_holds where idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.user_id <> p_user_id then raise exception 'Usage idempotency key belongs to another payer'; end if;
    if v_existing.status = 'held' then return v_existing.id; end if;
    raise exception 'Usage reservation is no longer active';
  end if;

  insert into public.usage_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_wallet from public.usage_wallets where user_id = p_user_id for update;

  with expired as (
    update public.usage_holds
    set status = 'expired', updated_at = now()
    where user_id = p_user_id and status = 'held' and expires_at <= now()
    returning maximum_microusd
  ) select coalesce(sum(maximum_microusd), 0) into v_expired_reserved from expired;

  if v_expired_reserved > 0 then
    update public.usage_wallets
    set reserved_microusd = greatest(0, reserved_microusd - v_expired_reserved), updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;
  end if;

  if (v_wallet.balance_microusd - v_wallet.reserved_microusd) < p_maximum_microusd then
    raise exception 'Insufficient RPG Your Way usage balance';
  end if;

  insert into public.usage_holds (user_id, maximum_microusd, source, source_ref, idempotency_key, expires_at)
  values (p_user_id, p_maximum_microusd, btrim(p_source), nullif(btrim(p_source_ref), ''), btrim(p_idempotency_key), p_expires_at)
  returning id into v_hold_id;

  update public.usage_wallets
  set reserved_microusd = reserved_microusd + p_maximum_microusd, updated_at = now()
  where user_id = p_user_id;

  return v_hold_id;
end;
$$;

create or replace function public.rpgyw_release_usage_for_user(p_user_id uuid, p_hold_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_hold public.usage_holds%rowtype;
  v_available bigint := 0;
begin
  select * into v_hold from public.usage_holds where id = p_hold_id and user_id = p_user_id for update;
  if not found then return 0; end if;

  if v_hold.status = 'held' then
    update public.usage_wallets
    set reserved_microusd = greatest(0, reserved_microusd - v_hold.maximum_microusd), updated_at = now()
    where user_id = p_user_id;
    update public.usage_holds set status = 'released', updated_at = now() where id = p_hold_id;
  end if;

  select balance_microusd - reserved_microusd into v_available from public.usage_wallets where user_id = p_user_id;
  return coalesce(v_available, 0);
end;
$$;

-- Capture every payer share in one database transaction. A shared turn is never
-- allowed to debit three players and then fail on the fourth.
create or replace function public.rpgyw_capture_multiplayer_turn(
  p_turn_id uuid,
  p_provider_total_microusd bigint,
  p_ttt_provider_microusd bigint,
  p_gameplay_provider_microusd bigint,
  p_tts_provider_microusd bigint,
  p_captures jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_item jsonb;
  v_charge public.multiplayer_turn_charges%rowtype;
  v_hold public.usage_holds%rowtype;
  v_wallet public.usage_wallets%rowtype;
  v_payer_user_id uuid;
  v_billed bigint;
  v_ttt bigint;
  v_gameplay bigint;
  v_tts bigint;
  v_balance bigint;
  v_total bigint := 0;
  v_expected_count integer := 0;
  v_capture_count integer := 0;
  v_distinct_payers integer := 0;
begin
  if p_turn_id is null then raise exception 'Multiplayer turn is required'; end if;
  if jsonb_typeof(p_captures) <> 'array' then raise exception 'Multiplayer captures must be an array'; end if;

  select count(*) into v_expected_count
  from public.multiplayer_turn_charges
  where turn_id = p_turn_id;

  select count(*), count(distinct value ->> 'payer_user_id')
  into v_capture_count, v_distinct_payers
  from jsonb_array_elements(p_captures);

  if v_expected_count = 0 or v_capture_count <> v_expected_count or v_distinct_payers <> v_expected_count then
    raise exception 'Multiplayer payer roster changed before settlement';
  end if;

  for v_item in select value from jsonb_array_elements(p_captures)
  loop
    begin
      v_payer_user_id := (v_item ->> 'payer_user_id')::uuid;
    exception when others then
      raise exception 'Invalid multiplayer payer';
    end;
    v_billed := greatest(0, coalesce((v_item ->> 'billed_microusd')::bigint, 0));
    v_ttt := greatest(0, coalesce((v_item ->> 'ttt_billed_microusd')::bigint, 0));
    v_gameplay := greatest(0, coalesce((v_item ->> 'gameplay_billed_microusd')::bigint, 0));
    v_tts := greatest(0, coalesce((v_item ->> 'tts_billed_microusd')::bigint, 0));

    if v_ttt + v_gameplay + v_tts <> v_billed then
      raise exception 'Multiplayer category allocation does not match payer total';
    end if;

    select * into v_charge
    from public.multiplayer_turn_charges
    where turn_id = p_turn_id and payer_user_id = v_payer_user_id
    for update;
    if not found then raise exception 'Multiplayer payer charge not found'; end if;
    if v_billed > v_charge.maximum_microusd then raise exception 'Multiplayer charge exceeds payer reservation'; end if;

    v_balance := null;
    if v_charge.owner_qa_exempt then
      if v_billed <> 0 then raise exception 'Owner QA payer share must be zero'; end if;
    else
      if v_charge.usage_hold_id is null then raise exception 'Multiplayer payer reservation is missing'; end if;
      select * into v_hold
      from public.usage_holds
      where id = v_charge.usage_hold_id and user_id = v_payer_user_id
      for update;
      if not found then raise exception 'Multiplayer payer usage hold not found'; end if;

      if v_hold.status = 'captured' then
        if v_hold.captured_microusd <> v_billed then raise exception 'Multiplayer payer hold was captured for a different amount'; end if;
        select balance_microusd into v_balance from public.usage_wallets where user_id = v_payer_user_id;
      elsif v_hold.status = 'held' then
        select * into v_wallet from public.usage_wallets where user_id = v_payer_user_id for update;
        if not found then raise exception 'Multiplayer payer wallet not found'; end if;
        if v_wallet.balance_microusd < v_billed then raise exception 'Insufficient RPG Your Way usage balance'; end if;

        v_balance := v_wallet.balance_microusd - v_billed;
        update public.usage_wallets
        set balance_microusd = v_balance,
            reserved_microusd = greatest(0, reserved_microusd - v_hold.maximum_microusd),
            lifetime_debited_microusd = lifetime_debited_microusd + v_billed,
            updated_at = now()
        where user_id = v_payer_user_id;

        update public.usage_holds
        set captured_microusd = v_billed, status = 'captured', updated_at = now()
        where id = v_hold.id;

        if v_billed > 0 then
          insert into public.usage_ledger (
            user_id, entry_type, amount_microusd, balance_after_microusd,
            source, source_ref, idempotency_key, metadata
          ) values (
            v_payer_user_id, 'debit', -v_billed, v_balance,
            v_hold.source, v_hold.source_ref,
            'capture:' || v_hold.id::text,
            jsonb_build_object(
              'surface', 'play',
              'feature', 'multiplayer-gameplay-turn',
              'multiplayer_turn_id', p_turn_id,
              'turn_billing_id', p_turn_id,
              'seat_count', v_charge.seat_count,
              'ttt_billed_microusd', v_ttt,
              'gameplay_billed_microusd', v_gameplay,
              'tts_billed_microusd', v_tts
            )
          ) on conflict (idempotency_key) do nothing;
        end if;
      else
        raise exception 'Multiplayer payer usage hold is not active';
      end if;
    end if;

    update public.multiplayer_turn_charges
    set billed_microusd = v_billed,
        ttt_billed_microusd = v_ttt,
        gameplay_billed_microusd = v_gameplay,
        tts_billed_microusd = v_tts,
        balance_after_microusd = v_balance,
        status = 'settled',
        updated_at = now()
    where turn_id = p_turn_id and payer_user_id = v_payer_user_id;

    v_total := v_total + v_billed;
  end loop;

  update public.multiplayer_turns
  set billing_status = 'settled',
      provider_total_microusd = greatest(0, coalesce(p_provider_total_microusd, 0)),
      billed_total_microusd = v_total,
      ttt_provider_microusd = greatest(0, coalesce(p_ttt_provider_microusd, 0)),
      gameplay_provider_microusd = greatest(0, coalesce(p_gameplay_provider_microusd, 0)),
      tts_provider_microusd = greatest(0, coalesce(p_tts_provider_microusd, 0)),
      settlement_warning = null,
      updated_at = now()
  where id = p_turn_id;

  if not found then raise exception 'Multiplayer turn not found'; end if;
  return v_total;
end;
$$;

revoke all on function public.rpgyw_begin_multiplayer_turn(uuid, uuid, uuid, uuid, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.rpgyw_reserve_usage_for_user(uuid, bigint, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.rpgyw_release_usage_for_user(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rpgyw_capture_multiplayer_turn(uuid, bigint, bigint, bigint, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.rpgyw_begin_multiplayer_turn(uuid, uuid, uuid, uuid, bigint, timestamptz) to service_role;
grant execute on function public.rpgyw_reserve_usage_for_user(uuid, bigint, text, text, text, timestamptz) to service_role;
grant execute on function public.rpgyw_release_usage_for_user(uuid, uuid) to service_role;
grant execute on function public.rpgyw_capture_multiplayer_turn(uuid, bigint, bigint, bigint, bigint, jsonb) to service_role;

-- Customer account summaries include the payer's share of multiplayer turns,
-- while ordinary solo/replay turns continue to come from play_turn_billing.
create or replace function public.rpgyw_usage_summary()
returns table (
  ai_processing_microusd bigint,
  talk_to_text_microusd bigint,
  readback_microusd bigint,
  total_microusd bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_ai bigint := 0;
  v_ttt bigint := 0;
  v_tts bigint := 0;
  v_legacy_ai bigint := 0;
  v_mp_ai bigint := 0;
  v_mp_ttt bigint := 0;
  v_mp_tts bigint := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select
    coalesce(sum(gameplay_billed_microusd), 0),
    coalesce(sum(ttt_billed_microusd), 0),
    coalesce(sum(tts_billed_microusd), 0)
  into v_ai, v_ttt, v_tts
  from public.play_turn_billing
  where user_id = v_user_id
    and status = 'settled'
    and multiplayer_turn_id is null;

  select
    coalesce(sum(gameplay_billed_microusd), 0),
    coalesce(sum(ttt_billed_microusd), 0),
    coalesce(sum(tts_billed_microusd), 0)
  into v_mp_ai, v_mp_ttt, v_mp_tts
  from public.multiplayer_turn_charges
  where payer_user_id = v_user_id
    and status = 'settled';

  select coalesce(sum(abs(amount_microusd)), 0)
  into v_legacy_ai
  from public.usage_ledger
  where user_id = v_user_id
    and entry_type = 'debit'
    and (
      source = 'shape'
      or (
        source = 'play'
        and coalesce(metadata ->> 'turn_billing_id', '') = ''
        and coalesce(metadata ->> 'multiplayer_turn_id', '') = ''
      )
    );

  v_ai := v_ai + v_mp_ai + v_legacy_ai;
  v_ttt := v_ttt + v_mp_ttt;
  v_tts := v_tts + v_mp_tts;
  return query select v_ai, v_ttt, v_tts, v_ai + v_ttt + v_tts;
end;
$$;
