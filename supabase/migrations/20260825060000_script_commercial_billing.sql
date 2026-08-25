-- RPG Your Way 1.6.200: commercial Script billing fields.
-- The shared wallet functions already exist in 20260825003000_shared_usage_balance.sql.

alter table public.shape_usage_events
  add column if not exists cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0);

alter table public.shape_jobs
  add column if not exists cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
  add column if not exists usage_hold_id uuid references public.usage_holds(id) on delete set null,
  add column if not exists maximum_deduction_microusd bigint check (maximum_deduction_microusd is null or maximum_deduction_microusd >= 0),
  add column if not exists provider_cost_microusd bigint not null default 0 check (provider_cost_microusd >= 0),
  add column if not exists billed_microusd bigint not null default 0 check (billed_microusd >= 0);

create index if not exists shape_jobs_usage_hold_idx
  on public.shape_jobs (usage_hold_id)
  where usage_hold_id is not null;
