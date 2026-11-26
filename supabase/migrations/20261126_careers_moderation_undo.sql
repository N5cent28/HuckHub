-- HuckHub Careers: undoable removals + claim history (run after 20261123).
--
-- * career_suppress_profile now snapshots the profile (fields, teams, vector)
--   before deleting it from the directory, and no longer deletes admin edits
--   or votes, so an admin can restore it instantly with career_restore_profile.
-- * Snapshots older than 30 days are purged by publish-careers.
-- * career_claim_events records claims/revocations so the app can cap how many
--   profiles one account can claim and an admin can undo a bad account.

create table if not exists career_profile_snapshots (
  player_uid text primary key,
  profile jsonb not null,
  teams jsonb not null,
  embedding text,
  created_at timestamptz not null default now()
);

create table if not exists career_claim_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_uid text not null,
  action text not null check (action in ('claimed', 'revoked', 'released')),
  actor_user_id uuid references auth.users(id) on delete set null,
  linkedin_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_career_claim_events_user on career_claim_events (user_id, created_at desc);
create index if not exists idx_career_claim_events_recent on career_claim_events (created_at desc);
create index if not exists idx_career_suppressions_requested_by on career_profile_suppressions (requested_by);

-- Existing claims count toward the per-account limit.
insert into career_claim_events (user_id, player_uid, action, created_at)
select o.user_id, o.player_uid, 'claimed', coalesce(o.claimed_at, o.created_at)
from career_profile_overrides o
where o.player_uid is not null
  and not exists (select 1 from career_claim_events e where e.user_id = o.user_id and e.player_uid = o.player_uid);

alter table career_profile_snapshots enable row level security;
alter table career_claim_events enable row level security;
revoke all on career_profile_snapshots, career_claim_events from anon, authenticated;

create or replace function career_suppress_profile(
  p_uid text,
  p_reason text,
  p_requested_by uuid default null
)
returns void
language plpgsql volatile
set search_path = public, extensions
as $$
begin
  insert into career_profile_suppressions (player_uid, reason, requested_by)
  values (p_uid, p_reason, p_requested_by)
  on conflict (player_uid) do nothing;

  insert into career_profile_snapshots (player_uid, profile, teams, embedding)
  select p.player_uid,
         to_jsonb(p) - 'id',
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'team_name', t.team_name, 'year', t.year,
             'competition_level', t.competition_level, 'division_name', t.division_name,
             'team_location', t.team_location, 'is_coach', pt.is_coach))
           from career_profile_teams pt
           join career_teams t on t.team_key = pt.team_key
           where pt.profile_id = p.id
         ), '[]'::jsonb),
         (select e.embedding::text from career_profile_embeddings e where e.profile_id = p.id)
  from career_profiles p
  where p.player_uid = p_uid
  on conflict (player_uid) do update
    set profile = excluded.profile, teams = excluded.teams,
        embedding = excluded.embedding, created_at = now();

  -- Cascades to team links and the vector. Admin edits and votes are kept
  -- (the app hides them while suppressed) so a restore is complete.
  delete from career_profiles where player_uid = p_uid;
end;
$$;

-- Undo a removal. Returns true if the profile is back in the directory now;
-- false if there was no snapshot (it will return on the next publish).
create or replace function career_restore_profile(p_uid text)
returns boolean
language plpgsql volatile
set search_path = public, extensions
as $$
declare
  v_snap career_profile_snapshots%rowtype;
  v_id integer;
  v_key integer;
  t jsonb;
begin
  delete from career_profile_suppressions where player_uid = p_uid;

  if exists (select 1 from career_profiles where player_uid = p_uid) then
    delete from career_profile_snapshots where player_uid = p_uid;
    return true;
  end if;

  select * into v_snap from career_profile_snapshots where player_uid = p_uid;
  if not found then
    return false;
  end if;

  select coalesce(max(id), 0) + 1 into v_id from career_profiles;
  insert into career_profiles
  select (jsonb_populate_record(null::career_profiles, v_snap.profile || jsonb_build_object('id', v_id))).*;

  for t in select value from jsonb_array_elements(v_snap.teams) loop
    v_key := null;
    select ct.team_key into v_key
    from career_teams ct
    where ct.team_name = t->>'team_name'
      and ct.year = (t->>'year')::smallint
      and ct.competition_level is not distinct from t->>'competition_level'
      and ct.division_name is not distinct from t->>'division_name'
      and ct.team_location is not distinct from t->>'team_location'
    limit 1;
    if v_key is null then
      select coalesce(max(team_key), 0) + 1 into v_key from career_teams;
      insert into career_teams (team_key, team_name, year, competition_level, division_name, team_location)
      values (v_key, t->>'team_name', (t->>'year')::smallint, t->>'competition_level',
              t->>'division_name', t->>'team_location');
    end if;
    insert into career_profile_teams (profile_id, team_key, is_coach)
    values (v_id, v_key, coalesce((t->>'is_coach')::boolean, false))
    on conflict do nothing;
  end loop;

  if v_snap.embedding is not null then
    insert into career_profile_embeddings (profile_id, embedding)
    values (v_id, v_snap.embedding::halfvec(384));
  end if;

  delete from career_profile_snapshots where player_uid = p_uid;
  return true;
end;
$$;

revoke execute on function
  career_suppress_profile(text, text, uuid),
  career_restore_profile(text)
  from public, anon, authenticated;

grant execute on function
  career_suppress_profile(text, text, uuid),
  career_restore_profile(text)
  to service_role;

grant all on career_profile_snapshots, career_claim_events to service_role;
grant usage, select on sequence career_claim_events_id_seq to service_role;
