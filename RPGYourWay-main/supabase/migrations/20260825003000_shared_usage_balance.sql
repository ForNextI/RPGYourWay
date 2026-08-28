-- RPG Your Way shared prepaid usage balance.
-- One account wallet is used by both Play and Shape.
-- Internal unit: one micro-US-dollar = $0.000001. This keeps sub-cent AI usage
-- precise while keeping all stored arithmetic integer-only.

create table if not exists public.usage_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_microusd bigint not null default 0 check (balance_microusd >= 0),
  reserved_microusd bigint not null default 0 check (reserved_microusd >= 0),
  lifetime_credited_microusd bigint not null default 0 check (lifetime_credited_microusd >= 0),
  lifetime_debited_microusd bigint not null default 0 check (lifetime_debited_microusd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_wallet_reserved_not_over_balance
    check (reserved_microusd <= balance_microusd)
);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('credit', 'debit', 'refund', 'adjustment')),
  amount_microusd bigint not null check (amount_microusd <> 0),
  balance_after_microusd bigint not null check (balance_after_microusd >= 0),
  source text not null,
  source_ref text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_ledger_amount_direction check (
    (entry_type in ('credit', 'refund') and amount_microusd > 0)
    or (entry_type = 'debit' and amount_microusd < 0)
    or entry_type = 'adjustment'
  )
);

create index if not exists usage_ledger_user_created_idx
  on public.usage_ledger (user_id, created_at desc);
create index if not exists usage_ledger_source_ref_idx
  on public.usage_ledger (source, source_ref)
  where source_ref is not null;

create table if not exists public.usage_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  maximum_microusd bigint not null check (maximum_microusd > 0),
  captured_microusd bigint not null default 0 check (captured_microusd >= 0),
  source text not null,
  source_ref text,
  idempotency_key text not null unique,
  status text not null default 'held' check (status in ('held', 'captured', 'released', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_hold_capture_not_over_maximum
    check (captured_microusd <= maximum_microusd)
);

create index if not exists usage_holds_user_status_idx
  on public.usage_holds (user_id, status, created_at desc);

alter table public.usage_wallets enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.usage_holds enable row level security;

drop policy if exists "usage_wallets_select_own" on public.usage_wallets;
create policy "usage_wallets_select_own" on public.usage_wallets
  for select using (auth.uid() = user_id);

drop policy if exists "usage_ledger_select_own" on public.usage_ledger;
create policy "usage_ledger_select_own" on public.usage_ledger
  for select using (auth.uid() = user_id);

drop policy if exists "usage_holds_select_own" on public.usage_holds;
create policy "usage_holds_select_own" on public.usage_holds
  for select using (auth.uid() = user_id);

-- Existing accounts receive an empty wallet immediately.
insert into public.usage_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Future accounts receive a wallet when Supabase Auth creates the user.
create or replace function public.rpgyw_create_usage_wallet_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.usage_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists rpgyw_create_usage_wallet_after_signup on auth.users;
create trigger rpgyw_create_usage_wallet_after_signup
after insert on auth.users
for each row execute function public.rpgyw_create_usage_wallet_for_new_user();

-- Reclaim expired reservations and return the account's currently available balance.
create or replace function public.rpgyw_release_expired_usage()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expired_reserved bigint := 0;
  v_available bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.usage_wallets (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.usage_wallets where user_id = v_user_id for update;

  with expired as (
    update public.usage_holds
    set status = 'expired', updated_at = now()
    where user_id = v_user_id
      and status = 'held'
      and expires_at <= now()
    returning maximum_microusd
  )
  select coalesce(sum(maximum_microusd), 0) into v_expired_reserved from expired;

  if v_expired_reserved > 0 then
    update public.usage_wallets
    set reserved_microusd = greatest(0, reserved_microusd - v_expired_reserved),
        updated_at = now()
    where user_id = v_user_id;
  end if;

  select balance_microusd - reserved_microusd into v_available
  from public.usage_wallets
  where user_id = v_user_id;

  return coalesce(v_available, 0);
end;
$$;

-- Reserve up to a quoted maximum before a billable AI operation begins.
-- The hold prevents two simultaneous requests from spending the same balance.
create or replace function public.rpgyw_reserve_usage(
  p_maximum_microusd bigint,
  p_source text,
  p_source_ref text,
  p_idempotency_key text,
  p_expires_at timestamptz default (now() + interval '30 minutes')
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.usage_holds%rowtype;
  v_wallet public.usage_wallets%rowtype;
  v_hold_id uuid;
  v_expired_reserved bigint := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_maximum_microusd is null or p_maximum_microusd <= 0 then
    raise exception 'Reservation amount must be positive';
  end if;
  if coalesce(btrim(p_source), '') = '' or coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'Source and idempotency key are required';
  end if;
  if p_expires_at <= now() then
    raise exception 'Reservation expiry must be in the future';
  end if;

  select * into v_existing
  from public.usage_holds
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.user_id <> v_user_id then
      raise exception 'Idempotency key already belongs to another account';
    end if;
    return v_existing.id;
  end if;

  insert into public.usage_wallets (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.usage_wallets
  where user_id = v_user_id
  for update;

  -- Reclaim abandoned reservations before checking what is actually available.
  with expired as (
    update public.usage_holds
    set status = 'expired', updated_at = now()
    where user_id = v_user_id
      and status = 'held'
      and expires_at <= now()
    returning maximum_microusd
  )
  select coalesce(sum(maximum_microusd), 0) into v_expired_reserved from expired;

  if v_expired_reserved > 0 then
    update public.usage_wallets
    set reserved_microusd = greatest(0, reserved_microusd - v_expired_reserved),
        updated_at = now()
    where user_id = v_user_id
    returning * into v_wallet;
  end if;

  if (v_wallet.balance_microusd - v_wallet.reserved_microusd) < p_maximum_microusd then
    raise exception 'Insufficient RPG Your Way usage balance';
  end if;

  insert into public.usage_holds (
    user_id, maximum_microusd, source, source_ref, idempotency_key, expires_at
  ) values (
    v_user_id, p_maximum_microusd, btrim(p_source), nullif(btrim(p_source_ref), ''), btrim(p_idempotency_key), p_expires_at
  ) returning id into v_hold_id;

  update public.usage_wallets
  set reserved_microusd = reserved_microusd + p_maximum_microusd,
      updated_at = now()
  where user_id = v_user_id;

  return v_hold_id;
end;
$$;

-- Release an unused quote/hold. Safe to call repeatedly.
create or replace function public.rpgyw_release_usage(p_hold_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_hold public.usage_holds%rowtype;
  v_available bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_hold
  from public.usage_holds
  where id = p_hold_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Usage hold not found';
  end if;

  if v_hold.status = 'held' then
    update public.usage_wallets
    set reserved_microusd = greatest(0, reserved_microusd - v_hold.maximum_microusd),
        updated_at = now()
    where user_id = v_user_id;

    update public.usage_holds
    set status = 'released', updated_at = now()
    where id = p_hold_id;
  end if;

  select balance_microusd - reserved_microusd into v_available
  from public.usage_wallets
  where user_id = v_user_id;

  return coalesce(v_available, 0);
end;
$$;

-- Capture actual successful usage against a reservation. The actual debit can
-- be lower than the quoted maximum, but never higher.
create or replace function public.rpgyw_capture_usage(
  p_hold_id uuid,
  p_actual_microusd bigint,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_hold public.usage_holds%rowtype;
  v_wallet public.usage_wallets%rowtype;
  v_new_balance bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_actual_microusd is null or p_actual_microusd < 0 then
    raise exception 'Actual usage cannot be negative';
  end if;

  select * into v_hold
  from public.usage_holds
  where id = p_hold_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Usage hold not found';
  end if;

  if v_hold.status = 'captured' then
    select balance_microusd into v_new_balance
    from public.usage_wallets where user_id = v_user_id;
    return coalesce(v_new_balance, 0);
  end if;

  if v_hold.status <> 'held' then
    raise exception 'Usage hold is no longer active';
  end if;
  if p_actual_microusd > v_hold.maximum_microusd then
    raise exception 'Actual usage exceeds the quoted maximum';
  end if;

  select * into v_wallet
  from public.usage_wallets
  where user_id = v_user_id
  for update;

  if v_wallet.balance_microusd < p_actual_microusd then
    raise exception 'Insufficient RPG Your Way usage balance';
  end if;

  v_new_balance := v_wallet.balance_microusd - p_actual_microusd;

  update public.usage_wallets
  set balance_microusd = v_new_balance,
      reserved_microusd = greatest(0, reserved_microusd - v_hold.maximum_microusd),
      lifetime_debited_microusd = lifetime_debited_microusd + p_actual_microusd,
      updated_at = now()
  where user_id = v_user_id;

  update public.usage_holds
  set status = 'captured', captured_microusd = p_actual_microusd, updated_at = now()
  where id = p_hold_id;

  if p_actual_microusd > 0 then
    insert into public.usage_ledger (
      user_id, entry_type, amount_microusd, balance_after_microusd,
      source, source_ref, idempotency_key, metadata
    ) values (
      v_user_id, 'debit', -p_actual_microusd, v_new_balance,
      v_hold.source, v_hold.source_ref, 'capture:' || v_hold.id::text,
      coalesce(p_metadata, '{}'::jsonb)
    ) on conflict (idempotency_key) do nothing;
  end if;

  return v_new_balance;
end;
$$;

-- Stripe (next phase) will call this with a server-side service-role client.
-- Authenticated browsers are deliberately not permitted to mint balance.
create or replace function public.rpgyw_credit_usage(
  p_user_id uuid,
  p_amount_microusd bigint,
  p_source text,
  p_source_ref text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_balance bigint;
  v_new_balance bigint;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if p_amount_microusd is null or p_amount_microusd <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  if coalesce(btrim(p_source), '') = '' or coalesce(btrim(p_idempotency_key), '') = '' then
    raise exception 'Source and idempotency key are required';
  end if;

  select balance_after_microusd into v_existing_balance
  from public.usage_ledger
  where idempotency_key = p_idempotency_key
    and user_id = p_user_id;
  if found then
    return v_existing_balance;
  end if;

  if exists (
    select 1 from public.usage_ledger
    where idempotency_key = p_idempotency_key
      and user_id <> p_user_id
  ) then
    raise exception 'Idempotency key already belongs to another account';
  end if;

  insert into public.usage_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.usage_wallets where user_id = p_user_id for update;

  update public.usage_wallets
  set balance_microusd = balance_microusd + p_amount_microusd,
      lifetime_credited_microusd = lifetime_credited_microusd + p_amount_microusd,
      updated_at = now()
  where user_id = p_user_id
  returning balance_microusd into v_new_balance;

  insert into public.usage_ledger (
    user_id, entry_type, amount_microusd, balance_after_microusd,
    source, source_ref, idempotency_key, metadata
  ) values (
    p_user_id, 'credit', p_amount_microusd, v_new_balance,
    btrim(p_source), nullif(btrim(p_source_ref), ''), btrim(p_idempotency_key),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_new_balance;
end;
$$;

-- Only these user-safe reservation/capture functions are callable from a
-- signed-in browser/session. Credits remain server/service-role only.
revoke all on function public.rpgyw_create_usage_wallet_for_new_user() from public, anon, authenticated;
revoke all on function public.rpgyw_release_expired_usage() from public, anon;
revoke all on function public.rpgyw_reserve_usage(bigint, text, text, text, timestamptz) from public, anon;
revoke all on function public.rpgyw_release_usage(uuid) from public, anon;
revoke all on function public.rpgyw_capture_usage(uuid, bigint, jsonb) from public, anon;
revoke all on function public.rpgyw_credit_usage(uuid, bigint, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.rpgyw_release_expired_usage() to authenticated;
grant execute on function public.rpgyw_reserve_usage(bigint, text, text, text, timestamptz) to authenticated;
grant execute on function public.rpgyw_release_usage(uuid) to authenticated;
grant execute on function public.rpgyw_capture_usage(uuid, bigint, jsonb) to authenticated;
grant execute on function public.rpgyw_credit_usage(uuid, bigint, text, text, text, jsonb) to service_role;
