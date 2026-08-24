create table if not exists public.shape_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled adventure',
  description_level text not null check (description_level in ('plain', 'light', 'rich', 'purple')),
  transcript text not null,
  transcript_characters integer not null check (transcript_characters >= 0 and transcript_characters <= 1000000),
  fingerprint text not null,
  status text not null default 'processing' check (status in ('processing', 'error', 'completed')),
  phase text not null default 'analysis',
  analysis_total integer not null default 0 check (analysis_total >= 0 and analysis_total <= 10),
  writing_total integer not null default 1 check (writing_total >= 1 and writing_total <= 40),
  next_analysis_chunk_index integer not null default 0 check (next_analysis_chunk_index >= 0),
  next_chunk_index integer not null default 0 check (next_chunk_index >= 0),
  continuity text not null default '',
  prose_text text not null default '',
  result_text text,
  prompt_version text,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists shape_jobs_user_updated_idx on public.shape_jobs (user_id, updated_at desc);

alter table public.shape_jobs enable row level security;

drop policy if exists "shape_jobs_select_own" on public.shape_jobs;
create policy "shape_jobs_select_own" on public.shape_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "shape_jobs_insert_own" on public.shape_jobs;
create policy "shape_jobs_insert_own" on public.shape_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "shape_jobs_update_own" on public.shape_jobs;
create policy "shape_jobs_update_own" on public.shape_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shape_jobs_delete_own" on public.shape_jobs;
create policy "shape_jobs_delete_own" on public.shape_jobs
  for delete using (auth.uid() = user_id);
