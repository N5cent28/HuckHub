-- Per-LinkedIn-candidate community votes (up to two candidates per profile)

alter table career_profile_votes
  add column if not exists linkedin_url text;

alter table career_profile_votes
  drop constraint if exists career_profile_votes_player_uid_voter_user_id_aspect_key;

create unique index if not exists idx_career_profile_votes_unique
  on career_profile_votes (player_uid, voter_user_id, aspect, coalesce(linkedin_url, ''));
