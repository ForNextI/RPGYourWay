-- Shape beta instrumentation and durable cross-part projects.
-- Apply after 20260824163000_shape_jobs.sql.

create table if not exists public.shape_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My Shape Project',
  continuity text not null default '',
  completed_parts integer not null default 0 check (completed_parts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shape_projects_user_updated_idx
  on public.shape_projects (user_id, updated_at desc);

alter table public.shape_jobs drop constraint if exists shape_jobs_status_check;
alter table public.shape_jobs
  add constraint shape_jobs_status_check
  check (status in ('processing', 'error', 'completed', 'cancelled'));

alter table public.shape_jobs
  add column if not exists project_id uuid references public.shape_projects(id) on delete set null,
  add column if not exists project_part_number integer not null default 1 check (project_part_number >= 1),
  add column if not exists prior_continuity text not null default '',
  add column if not exists cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  add column if not exists request_count integer not null default 0 check (request_count >= 0),
  add column if not exists model text;

create index if not exists shape_jobs_project_idx
  on public.shape_jobs (project_id, project_part_number);

create table if not exists public.shape_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.shape_jobs(id) on delete cascade,
  project_id uuid references public.shape_projects(id) on delete set null,
  phase text not null,
  operation text not null,
  model text not null,
  provider_request_id text,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  input_characters integer not null default 0 check (input_characters >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  success boolean not null default false,
  status_code integer,
  created_at timestamptz not null default now(),
  unique (job_id, operation)
);

create index if not exists shape_usage_events_user_created_idx
  on public.shape_usage_events (user_id, created_at desc);
create index if not exists shape_usage_events_job_idx
  on public.shape_usage_events (job_id, created_at asc);

alter table public.shape_projects enable row level security;
alter table public.shape_usage_events enable row level security;

drop policy if exists "shape_projects_select_own" on public.shape_projects;
create policy "shape_projects_select_own" on public.shape_projects
  for select using (auth.uid() = user_id);

drop policy if exists "shape_projects_insert_own" on public.shape_projects;
create policy "shape_projects_insert_own" on public.shape_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "shape_projects_update_own" on public.shape_projects;
create policy "shape_projects_update_own" on public.shape_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shape_projects_delete_own" on public.shape_projects;
create policy "shape_projects_delete_own" on public.shape_projects
  for delete using (auth.uid() = user_id);

drop policy if exists "shape_usage_events_select_own" on public.shape_usage_events;
create policy "shape_usage_events_select_own" on public.shape_usage_events
  for select using (auth.uid() = user_id);

drop policy if exists "shape_usage_events_insert_own" on public.shape_usage_events;
create policy "shape_usage_events_insert_own" on public.shape_usage_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "shape_usage_events_update_own" on public.shape_usage_events;
create policy "shape_usage_events_update_own" on public.shape_usage_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
