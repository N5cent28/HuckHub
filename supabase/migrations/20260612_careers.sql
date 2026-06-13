-- HuckHub Careers: user-authored profiles and impersonation reports
-- Run in Supabase SQL editor before using Careers features.

create table if not exists career_profile_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_uid text unique,
  full_name text not null,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  linkedin_url text,
  known_locations text[] not null default '{}',
  email text,
  open_to_career_chats boolean not null default false,
  embed_source_text text,
  embedding real[] check (array_length(embedding, 1) is null or array_length(embedding, 1) = 384),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_profile_overrides_user_id_key unique (user_id)
);

create index if not exists idx_career_overrides_player_uid on career_profile_overrides(player_uid);

create table if not exists career_impersonation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reported_player_uid text,
  reported_override_id uuid references career_profile_overrides(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

alter table career_profile_overrides enable row level security;
alter table career_impersonation_reports enable row level security;

-- Users read/update only their own career profile
create policy "Users read own career profile"
  on career_profile_overrides for select
  using (auth.uid() = user_id);

create policy "Users insert own career profile"
  on career_profile_overrides for insert
  with check (auth.uid() = user_id);

create policy "Users update own career profile"
  on career_profile_overrides for update
  using (auth.uid() = user_id);

create policy "Users insert impersonation reports"
  on career_impersonation_reports for insert
  with check (auth.uid() = reporter_user_id);

create policy "Users read own impersonation reports"
  on career_impersonation_reports for select
  using (auth.uid() = reporter_user_id);

-- Service role bypasses RLS for server-side search merge.

create or replace function career_profile_overrides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists career_profile_overrides_updated_at on career_profile_overrides;
create trigger career_profile_overrides_updated_at
  before update on career_profile_overrides
  for each row execute function career_profile_overrides_updated_at();
