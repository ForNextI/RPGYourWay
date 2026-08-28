-- RPG Your Way 1.8.12: whole-turn Play billing and customer-safe usage summaries.
--
-- A normal live exchange is settled exactly once after successful provider cost
-- from Talk-to-Text, gameplay AI, and Text-to-Speech has been accumulated.
-- Individual voice components are never independently rounded during that turn.

create table if not exists public.play_turn_billing (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'live' check (kind in ('live', 'replay')),
  source_ref text,
  status text not null default 'pending' check (status in ('pending', 'held', 'settled', 'released', 'error')),
  usage_hold_id uuid references public.usage_holds(id) on delete set null,
  maximum_microusd bigint not null default 0 check (maximum_microusd >= 0),
  owner_qa_exempt boolean not null default false,
  narration_expected boolean not null default false,
  gameplay_complete boolean not null default false,
  audio_complete_requested boolean not null default false,
  expected_tts_components integer not null default 0 check (expected_tts_components >= 0),
  ttt_provider_microusd bigint not null default 0 check (ttt_provider_microusd >= 0),
  gameplay_provider_microusd bigint not null default 0 check (gameplay_provider_microusd >= 0),
  tts_provider_microusd bigint not null default 0 check (tts_provider_microusd >= 0),
  provider_total_microusd bigint not null default 0 check (provider_total_microusd >= 0),
  billed_microusd bigint not null default 0 check (billed_microusd >= 0),
  ttt_billed_microusd bigint not null default 0 check (ttt_billed_microusd >= 0),
  gameplay_billed_microusd bigint not null default 0 check (gameplay_billed_microusd >= 0),
  tts_billed_microusd bigint not null default 0 check (tts_billed_microusd >= 0),
  balance_after_microusd bigint,
  settlement_warning text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists play_turn_billing_user_created_idx
  on public.play_turn_billing (user_id, created_at desc);
create index if not exists play_turn_billing_unsettled_idx
  on public.play_turn_billing (user_id, status, updated_at)
  where status in ('pending', 'held');

create table if not exists public.play_turn_components (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.play_turn_billing(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  component_id text not null,
  component_type text not null check (component_type in ('ttt', 'gameplay', 'tts')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  model text not null,
  provider_cost_microusd bigint not null default 0 check (provider_cost_microusd >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turn_id, component_id)
);

create index if not exists play_turn_components_turn_status_idx
  on public.play_turn_components (turn_id, component_type, status);

alter table public.play_turn_billing enable row level security;
alter table public.play_turn_components enable row level security;
-- These are internal billing records. There are intentionally no browser table
-- policies; customer-facing totals are exposed only through the aggregate RPCs below.

alter table public.provider_usage_events
  add column if not exists turn_id uuid references public.play_turn_billing(id) on delete set null,
  add column if not exists component_id text;

create index if not exists provider_usage_events_turn_idx
  on public.provider_usage_events (turn_id, created_at)
  where turn_id is not null;

-- Detailed wallet entries are no longer customer-readable. The billing engine and
-- service role keep the full ledger; customers receive aggregate usage and purchase
-- history through narrow security-definer functions.
drop policy if exists "usage_ledger_select_own" on public.usage_ledger;

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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    coalesce(sum(gameplay_billed_microusd), 0),
    coalesce(sum(ttt_billed_microusd), 0),
    coalesce(sum(tts_billed_microusd), 0)
  into v_ai, v_ttt, v_tts
  from public.play_turn_billing
  where user_id = v_user_id
    and status = 'settled';

  -- Script, paid character processing, and pre-1.8.12 Play debits are ordinary
  -- non-voice AI processing. New whole-turn captures carry turn_billing_id and
  -- are already represented by the allocated totals above.
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
      )
    );

  v_ai := v_ai + v_legacy_ai;

  return query select v_ai, v_ttt, v_tts, v_ai + v_ttt + v_tts;
end;
$$;

create or replace function public.rpgyw_purchase_history(p_limit integer default 50)
returns table (
  id uuid,
  created_at timestamptz,
  pack_name text,
  purchase_price_cents integer,
  usage_value_cents integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    l.id,
    l.created_at,
    coalesce(nullif(l.metadata ->> 'play_pack_name', ''), 'Play Pack') as pack_name,
    coalesce((l.metadata ->> 'purchase_price_cents')::integer, 0) as purchase_price_cents,
    coalesce((l.metadata ->> 'usage_value_cents')::integer, round(l.amount_microusd / 10000.0)::integer) as usage_value_cents
  from public.usage_ledger l
  where l.user_id = auth.uid()
    and l.entry_type = 'credit'
    and l.source = 'stripe'
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.rpgyw_usage_summary() from public, anon;
revoke all on function public.rpgyw_purchase_history(integer) from public, anon;
grant execute on function public.rpgyw_usage_summary() to authenticated;
grant execute on function public.rpgyw_purchase_history(integer) to authenticated;
