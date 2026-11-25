-- HuckHub Careers: scraped directory in Postgres + pgvector (replaces the
-- data/careers JSON + .npy bundle that was deployed with the Netlify functions).
--
-- Written by ExpertScraper `python -m expertscraper publish-careers`; read by
-- src/lib/careers/directory.ts through the RPC functions below.
--
-- Size notes (Supabase free tier = 500 MB shared with the throwing app):
--   * vectors are halfvec(384) (768 B each) and only exist for profiles with
--     career text; name/team-only profiles have no vector row
--   * team-seasons are stored once in career_teams and linked by integer keys
--   * profiles use an integer surrogate key so the 400K-row membership table
--     is two ints + a bool per row instead of repeating player_uid strings
--   * known_locations is not stored; it is derived from team locations
--
-- Access: RLS on with no policies, and RPCs revoked from anon/authenticated.
-- Only the service role (Next.js API routes) can read. This keeps the anon
-- key from dumping unblurred names / LinkedIn URLs through PostgREST.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists career_dataset_meta (
  id smallint primary key default 1 check (id = 1),
  generated_at timestamptz not null,
  schema_version text not null,
  embedding_model text not null,
  embedding_dim smallint not null,
  n_profiles integer not null,
  n_with_career integer not null,
  n_embeddings integer not null,
  n_teams integer not null
);

-- One row per distinct team-season.
create table if not exists career_teams (
  team_key integer primary key,
  team_name text not null,
  year smallint not null,
  competition_level text,
  division_name text,
  team_location text
);

create index if not exists idx_career_teams_location on career_teams (team_location);
create index if not exists idx_career_teams_division on career_teams (competition_level, division_name);

create table if not exists career_profiles (
  id integer primary key,
  player_uid text not null unique,
  full_name text not null,
  -- normalizeNameForMatch(full_name): lowercased "first last", [a-z0-9 ] only
  name_norm text not null,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  confidence_score real,
  linkedin_urls text[],
  llm_rationale text,
  has_career boolean not null default false,
  -- First calendar year the player is estimated to be 18+. Null = no age gate.
  adult_from_year smallint
);

create or replace function career_doc(
  career_field text, "current_role" text, education text, career_summary text
) returns tsvector
language sql immutable parallel safe
as $$
  select to_tsvector(
    'english'::regconfig,
    coalesce(career_field, '') || ' ' || coalesce("current_role", '') || ' ' ||
    coalesce(education, '') || ' ' || coalesce(career_summary, '')
  )
$$;

create index if not exists idx_career_profiles_name_trgm
  on career_profiles using gin (name_norm extensions.gin_trgm_ops);
create index if not exists idx_career_profiles_browse
  on career_profiles (has_career desc, name_norm);
create index if not exists idx_career_profiles_doc
  on career_profiles using gin (career_doc(career_field, "current_role", education, career_summary))
  where has_career;

create table if not exists career_profile_teams (
  profile_id integer not null references career_profiles(id) on delete cascade,
  team_key integer not null references career_teams(team_key) on delete cascade,
  is_coach boolean not null default false,
  primary key (profile_id, team_key)
);

create index if not exists idx_career_profile_teams_team on career_profile_teams (team_key);

create table if not exists career_profile_embeddings (
  profile_id integer primary key references career_profiles(id) on delete cascade,
  embedding extensions.halfvec(384) not null
);

-- Vectors are L2-normalized MiniLM output, so inner product == cosine.
-- The publisher drops and rebuilds this index around bulk loads.
create index if not exists idx_career_profile_embeddings_hnsw
  on career_profile_embeddings using hnsw (embedding extensions.halfvec_ip_ops);

-- People who asked to be removed. The publisher skips these player_uids so a
-- republish never brings a removed profile back.
create table if not exists career_profile_suppressions (
  player_uid text primary key,
  reason text not null check (reason in ('owner_request', 'admin_approved_request', 'admin')),
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Removal requests that need admin review (requester could not be verified
-- automatically, or is not signed in).
create table if not exists career_removal_requests (
  id uuid primary key default gen_random_uuid(),
  player_uid text not null,
  requester_user_id uuid references auth.users(id) on delete set null,
  contact_email text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_career_removal_requests_status
  on career_removal_requests (status, created_at desc);

alter table career_dataset_meta enable row level security;
alter table career_teams enable row level security;
alter table career_profiles enable row level security;
alter table career_profile_teams enable row level security;
alter table career_profile_embeddings enable row level security;
alter table career_profile_suppressions enable row level security;
alter table career_removal_requests enable row level security;

revoke all on career_dataset_meta, career_teams, career_profiles, career_profile_teams,
  career_profile_embeddings, career_profile_suppressions, career_removal_requests
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------

-- Distinct playing-team locations for one profile (what the UI calls known_locations).
create or replace function career_known_locations(p_profile_id integer)
returns text[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct t.team_location order by t.team_location), '{}')
  from career_profile_teams pt
  join career_teams t on t.team_key = pt.team_key
  where pt.profile_id = p_profile_id
    and not pt.is_coach
    and t.team_location is not null
$$;

-- Team history as JSON, shaped like the app's TeamEntry.
create or replace function career_team_history(p_profile_id integer)
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'team_name', t.team_name,
      'year', t.year,
      'competition_level', t.competition_level,
      'division_name', t.division_name,
      'team_location', t.team_location,
      'role', case when pt.is_coach then 'coach' else 'player' end
    ) order by t.year desc, t.team_name), '[]'::jsonb)
  from career_profile_teams pt
  join career_teams t on t.team_key = pt.team_key
  where pt.profile_id = p_profile_id
$$;

-- Full rows (with team history) for a set of player_uids: profile detail,
-- claims, and merging member/admin overrides.
create or replace function career_profiles_by_uid(p_uids text[])
returns table (
  player_uid text,
  full_name text,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  confidence_score real,
  linkedin_urls text[],
  llm_rationale text,
  adult_from_year smallint,
  has_embedding boolean,
  teams jsonb
)
language sql stable
set search_path = public
as $$
  select p.player_uid, p.full_name, p.career_field, p."current_role", p.education,
         p.career_summary, p.confidence_score, coalesce(p.linkedin_urls, '{}'),
         p.llm_rationale, p.adult_from_year,
         exists (select 1 from career_profile_embeddings e where e.profile_id = p.id),
         career_team_history(p.id)
  from career_profiles p
  where p.player_uid = any(p_uids)
$$;

-- Location strings and (competition_level, division_name) pairs for the
-- filter dropdowns. Labels are computed in TypeScript (teams.ts).
create or replace function career_facets()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(l order by l)
      from (select distinct team_location as l from career_teams where team_location is not null) s
    ), '[]'::jsonb),
    'divisions', coalesce((
      select jsonb_agg(jsonb_build_array(competition_level, division_name))
      from (select distinct competition_level, division_name from career_teams) s
    ), '[]'::jsonb)
  )
$$;

-- Fuzzy name lookup (claim suggestions). Final matching is namesMatch() in TS.
create or replace function career_name_candidates(
  p_query_norm text,
  p_as_of_year integer,
  p_limit integer default 50
)
returns table (player_uid text, full_name text)
language sql stable
set search_path = public, extensions
as $$
  select p.player_uid, p.full_name
  from career_profiles p
  where (p.name_norm % p_query_norm or p.name_norm = p_query_norm)
    and (p.adult_from_year is null or p.adult_from_year <= p_as_of_year)
  order by similarity(p.name_norm, p_query_norm) desc, p.has_career desc
  limit p_limit
$$;

-- ---------------------------------------------------------------------------
-- Team-based filters (location / division) resolved once to a profile-id set.
-- Returns null when neither filter is set (= no restriction).
-- ---------------------------------------------------------------------------

create or replace function career_filter_ids(
  p_locations text[],
  p_div_levels text[],
  p_div_names text[]
)
returns integer[]
language plpgsql stable
set search_path = public
as $$
declare
  v_loc integer[];
  v_div integer[];
begin
  if p_locations is not null then
    select coalesce(array_agg(distinct pt.profile_id), '{}') into v_loc
    from career_teams ct
    join career_profile_teams pt on pt.team_key = ct.team_key
    where ct.team_location = any(p_locations);
  end if;

  if p_div_levels is not null then
    select coalesce(array_agg(distinct pt.profile_id), '{}') into v_div
    from career_teams ct
    join unnest(p_div_levels, p_div_names) as d(lvl, nm)
      on coalesce(ct.competition_level, '') = d.lvl and coalesce(ct.division_name, '') = d.nm
    join career_profile_teams pt on pt.team_key = ct.team_key and not pt.is_coach;
  end if;

  if v_loc is not null and v_div is not null then
    return array(select unnest(v_loc) intersect select unnest(v_div));
  end if;
  return coalesce(v_loc, v_div);
end;
$$;

-- ---------------------------------------------------------------------------
-- Browse (no query): career profiles first, then alphabetical.
-- ---------------------------------------------------------------------------

create or replace function career_browse(
  p_locations text[] default null,
  p_div_levels text[] default null,
  p_div_names text[] default null,
  p_min_confidence real default null,
  p_linkedin_min_confidence real default null,
  p_as_of_year integer default null,
  p_exclude_uids text[] default '{}',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table (
  player_uid text,
  full_name text,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  confidence_score real,
  linkedin_urls text[],
  known_locations text[],
  total_count bigint
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ids integer[] := career_filter_ids(p_locations, p_div_levels, p_div_names);
  v_year integer := coalesce(p_as_of_year, extract(year from now())::int);
  v_total bigint;
begin
  if v_ids is null then
    select count(*) into v_total
    from career_profiles p
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
      and (p_linkedin_min_confidence is null
           or (p.linkedin_urls is not null and coalesce(p.confidence_score, 0) >= p_linkedin_min_confidence))
      and not (p.player_uid = any(p_exclude_uids));

    return query
    select p.player_uid, p.full_name, p.career_field, p."current_role", p.education,
           p.career_summary, p.confidence_score, coalesce(p.linkedin_urls, '{}'),
           career_known_locations(p.id), v_total
    from career_profiles p
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
      and (p_linkedin_min_confidence is null
           or (p.linkedin_urls is not null and coalesce(p.confidence_score, 0) >= p_linkedin_min_confidence))
      and not (p.player_uid = any(p_exclude_uids))
    order by p.has_career desc, p.name_norm
    offset greatest(p_offset, 0)
    limit greatest(p_limit, 0);
    return;
  end if;

  return query
  with matched as materialized (
    select p.id, p.player_uid, p.full_name, p.name_norm, p.has_career, p.career_field,
           p."current_role", p.education, p.career_summary, p.confidence_score, p.linkedin_urls
    from unnest(v_ids) as f(id)
    join career_profiles p on p.id = f.id
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
      and (p_linkedin_min_confidence is null
           or (p.linkedin_urls is not null and coalesce(p.confidence_score, 0) >= p_linkedin_min_confidence))
      and not (p.player_uid = any(p_exclude_uids))
  ),
  counted as (select count(*) as n from matched),
  page as (
    select * from matched
    order by has_career desc, name_norm
    offset greatest(p_offset, 0)
    limit greatest(p_limit, 0)
  )
  select pg.player_uid, pg.full_name, pg.career_field, pg."current_role", pg.education,
         pg.career_summary, pg.confidence_score, coalesce(pg.linkedin_urls, '{}'),
         career_known_locations(pg.id), c.n
  from page pg cross join counted c
  order by pg.has_career desc, pg.name_norm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search: candidate generation (name, keyword, location, semantic) then the
-- same additive scoring the in-memory search used:
--   exact name 5 | name 1.2 | location 0.9 | keyword phrase 0.7 / token 0.4
--   + inner product with the query embedding
-- Returns the top p_limit rows plus the size of the scored candidate pool.
-- ---------------------------------------------------------------------------

create or replace function career_search(
  p_query text,
  p_query_norm text,
  p_query_vec text default null,
  p_locations text[] default null,
  p_div_levels text[] default null,
  p_div_names text[] default null,
  p_min_confidence real default null,
  p_linkedin_min_confidence real default null,
  p_as_of_year integer default null,
  p_exclude_uids text[] default '{}',
  p_limit integer default 30,
  p_semantic_k integer default 200
)
returns table (
  player_uid text,
  full_name text,
  career_field text,
  "current_role" text,
  education text,
  career_summary text,
  confidence_score real,
  linkedin_urls text[],
  known_locations text[],
  score double precision,
  reasons text[],
  total_count bigint
)
language plpgsql stable
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_ql text := lower(btrim(coalesce(p_query, '')));
  v_qn text := btrim(coalesce(p_query_norm, ''));
  v_name_tokens text[] := array_remove(string_to_array(v_qn, ' '), '');
  v_kw_tokens text[];
  v_tsq tsquery;
  v_vec halfvec(384);
  v_year integer := coalesce(p_as_of_year, extract(year from now())::int);
  v_filter integer[] := career_filter_ids(p_locations, p_div_levels, p_div_names);
  v_qloc integer[] := '{}';
  v_sem integer[] := '{}';
begin
  if v_ql = '' then
    return;
  end if;

  select coalesce(array_agg(t), '{}') into v_kw_tokens
  from unnest(regexp_split_to_array(v_ql, '\s+')) t
  where length(t) > 2;

  -- OR the query terms together so any matching word makes a candidate.
  v_tsq := nullif(replace(plainto_tsquery('english', v_ql)::text, '&', '|'), '')::tsquery;

  -- Profiles whose team locations contain the query text ("Madison").
  if length(v_ql) >= 3 then
    select coalesce(array_agg(distinct pt.profile_id), '{}') into v_qloc
    from career_teams ct
    join career_profile_teams pt on pt.team_key = ct.team_key
    where strpos(lower(ct.team_location), v_ql) > 0;
  end if;

  -- Semantic candidates. With a team filter the set is small, so score it
  -- exactly; otherwise use the HNSW index.
  if p_query_vec is not null then
    v_vec := p_query_vec::halfvec(384);
    if v_filter is not null then
      select coalesce(array_agg(id), '{}') into v_sem from (
        select emb.profile_id as id
        from unnest(v_filter) as f(id)
        join career_profile_embeddings emb on emb.profile_id = f.id
        order by emb.embedding <#> v_vec
        limit greatest(p_semantic_k, 0)
      ) s;
    else
      perform set_config('hnsw.ef_search', greatest(p_semantic_k, 40)::text, true);
      perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
      select coalesce(array_agg(id), '{}') into v_sem from (
        select emb.profile_id as id
        from career_profile_embeddings emb
        order by emb.embedding <#> v_vec
        limit greatest(p_semantic_k, 0)
      ) s;
    end if;
  end if;

  return query
  with
  name_c as (
    select p.id from career_profiles p
    where v_qn <> '' and (p.name_norm like '%' || v_qn || '%' or p.name_norm % v_qn)
    limit 300
  ),
  kw_c as (
    select p.id from career_profiles p
    where v_tsq is not null and p.has_career
      and career_doc(p.career_field, p."current_role", p.education, p.career_summary) @@ v_tsq
    limit 300
  ),
  loc_c as (
    select q.id from unnest(v_qloc) as q(id) limit 3000
  ),
  cand as (
    select id from name_c
    union select id from kw_c
    union select id from loc_c
    union select unnest(v_sem)
  ),
  eligible as (
    select p.*
    from cand c
    join career_profiles p on p.id = c.id
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
      and (p_linkedin_min_confidence is null
           or (p.linkedin_urls is not null and coalesce(p.confidence_score, 0) >= p_linkedin_min_confidence))
      and not (p.player_uid = any(p_exclude_uids))
      and (v_filter is null or p.id = any(v_filter))
  ),
  scored as (
    select e.id, e.player_uid, e.full_name, e.name_norm, e.career_field, e."current_role",
           e.education, e.career_summary, e.confidence_score, e.linkedin_urls,
           case
             when v_qn <> '' and e.name_norm = v_qn then 5.0
             when v_qn <> '' and (strpos(e.name_norm, v_qn) > 0
                  or (cardinality(v_name_tokens) > 0
                      and (select bool_and(strpos(e.name_norm, tok) > 0) from unnest(v_name_tokens) tok)))
               then 1.2
             else 0.0
           end as s_name,
           case when e.id = any(v_qloc) then 0.9 else 0.0 end as s_loc,
           lower(concat_ws(' ', e.career_field, e."current_role", e.education, e.career_summary)) as doc_text,
           case when v_vec is null then null else (
             select -(emb.embedding <#> v_vec)::double precision
             from career_profile_embeddings emb where emb.profile_id = e.id
           ) end as s_sem
    from eligible e
  ),
  totals as (
    select s.*,
           case
             when s.doc_text <> '' and strpos(s.doc_text, v_ql) > 0 then 0.7
             when s.doc_text <> '' and exists (select 1 from unnest(v_kw_tokens) tok where strpos(s.doc_text, tok) > 0) then 0.4
             else 0.0
           end as s_kw
    from scored s
  ),
  ranked as (
    select t.*,
           t.s_name + t.s_loc + t.s_kw + coalesce(t.s_sem, 0) as total,
           array_remove(array[
             case when t.s_name = 5.0 then 'exact_name' when t.s_name > 0 then 'name' end,
             case when t.s_loc > 0 then 'location' end,
             case when t.s_kw > 0 then 'keyword' end,
             case when t.s_sem > 0.35 then 'semantic' end
           ], null) as why
    from totals t
  ),
  kept as (
    select r.*, count(*) over () as n
    from ranked r
    where r.total > 0.05 or length(v_ql) <= 2
  ),
  top as (
    select * from kept
    order by total desc, name_norm
    limit greatest(p_limit, 0)
  )
  select tp.player_uid, tp.full_name, tp.career_field, tp."current_role", tp.education,
         tp.career_summary, tp.confidence_score, coalesce(tp.linkedin_urls, '{}'),
         career_known_locations(tp.id), tp.total, tp.why, tp.n
  from top tp
  order by tp.total desc, tp.name_norm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Removal
-- ---------------------------------------------------------------------------

-- Hide a scraped profile now and keep it out of future publishes.
create or replace function career_suppress_profile(
  p_uid text,
  p_reason text,
  p_requested_by uuid default null
)
returns void
language sql volatile
set search_path = public
as $$
  insert into career_profile_suppressions (player_uid, reason, requested_by)
  values (p_uid, p_reason, p_requested_by)
  on conflict (player_uid) do nothing;

  delete from career_profiles where player_uid = p_uid;
  delete from career_admin_edits where player_uid = p_uid;
  delete from career_profile_votes where player_uid = p_uid;
$$;

revoke execute on function
  career_doc(text, text, text, text),
  career_known_locations(integer),
  career_team_history(integer),
  career_profiles_by_uid(text[]),
  career_facets(),
  career_name_candidates(text, integer, integer),
  career_filter_ids(text[], text[], text[]),
  career_browse(text[], text[], text[], real, real, integer, text[], integer, integer),
  career_search(text, text, text, text[], text[], text[], real, real, integer, text[], integer, integer),
  career_suppress_profile(text, text, uuid)
  from public, anon, authenticated;

grant execute on function
  career_doc(text, text, text, text),
  career_known_locations(integer),
  career_team_history(integer),
  career_profiles_by_uid(text[]),
  career_facets(),
  career_name_candidates(text, integer, integer),
  career_filter_ids(text[], text[], text[]),
  career_browse(text[], text[], text[], real, real, integer, text[], integer, integer),
  career_search(text, text, text, text[], text[], text[], real, real, integer, text[], integer, integer),
  career_suppress_profile(text, text, uuid)
  to service_role;
