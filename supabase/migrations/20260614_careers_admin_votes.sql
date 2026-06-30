-- Admin corrections and community accuracy votes for Careers profiles

create table if not exists career_admin_edits (
  id uuid primary key default gen_random_uuid(),
  player_uid text not null unique,
  full_name text not null,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  linkedin_url text,
  known_locations text[] not null default '{}',
  embed_source_text text,
  embedding real[] check (array_length(embedding, 1) is null or array_length(embedding, 1) = 384),
  edited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_admin_edits_uid on career_admin_edits(player_uid);

create table if not exists career_profile_votes (
  id uuid primary key default gen_random_uuid(),
  player_uid text not null,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  aspect text not null check (aspect in ('overall', 'linkedin')),
  vote text not null check (vote in ('accurate', 'inaccurate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_uid, voter_user_id, aspect)
);

create index if not exists idx_career_profile_votes_uid on career_profile_votes(player_uid);

alter table career_admin_edits enable row level security;
alter table career_profile_votes enable row level security;

create policy "Users read own career votes"
  on career_profile_votes for select
  using (auth.uid() = voter_user_id);

create policy "Users upsert own career votes"
  on career_profile_votes for insert
  with check (auth.uid() = voter_user_id);

create policy "Users update own career votes"
  on career_profile_votes for update
  using (auth.uid() = voter_user_id);

create or replace function career_admin_edits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists career_admin_edits_updated_at on career_admin_edits;
create trigger career_admin_edits_updated_at
  before update on career_admin_edits
  for each row execute function career_admin_edits_updated_at();

create or replace function career_profile_votes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists career_profile_votes_updated_at on career_profile_votes;
create trigger career_profile_votes_updated_at
  before update on career_profile_votes
  for each row execute function career_profile_votes_updated_at();
