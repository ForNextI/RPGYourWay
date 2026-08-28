-- RPG Your Way 1.7.000: internal Play provider-cost ledger.
-- Customer wallet debits remain in usage_ledger. This table records the real
-- provider cost as a separate internal economic signal, including owner QA use.

create table if not exists public.provider_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surface text not null check (surface in ('play', 'script')),
  feature text not null,
  source_ref text,
  operation_id text not null,
  model text not null,
  provider_cost_microusd bigint not null default 0 check (provider_cost_microusd >= 0),
  billed_microusd bigint not null default 0 check (billed_microusd >= 0),
  owner_qa_exempt boolean not null default false,
  success boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, surface, feature, operation_id)
);

create index if not exists provider_usage_events_user_created_idx
  on public.provider_usage_events (user_id, created_at desc);
create index if not exists provider_usage_events_surface_feature_idx
  on public.provider_usage_events (surface, feature, created_at desc);

alter table public.provider_usage_events enable row level security;
-- Intentionally no browser read/write policies. Server-side service-role code
-- owns this internal cost ledger.
