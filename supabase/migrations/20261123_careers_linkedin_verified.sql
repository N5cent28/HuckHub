-- HuckHub Careers: "LinkedIn verified only" means community/admin verified.
--
-- Replaces the confidence-threshold version of the filter from
-- 20261122_careers_directory_pg.sql. Verification is decided in the app from
-- career_profile_votes (admin "accurate" vote, or >= 2 accurate member votes
-- with accurate > inaccurate) and passed in as (player_uid, linkedin_url)
-- pairs. A pair only counts while that URL is still one of the profile's
-- published LinkedIn candidates.

drop function if exists career_browse(text[], text[], text[], real, real, integer, text[], integer, integer);
drop function if exists career_search(text, text, text, text[], text[], text[], real, real, integer, text[], integer, integer);

-- Intersect an optional id set with profiles whose verified URL is still a candidate.
create or replace function career_restrict_to_verified(
  p_ids integer[],
  p_uids text[],
  p_urls text[]
)
returns integer[]
language sql stable
set search_path = public
as $$
  select coalesce(array_agg(distinct p.id), '{}')
  from unnest(p_uids, p_urls) as v(uid, url)
  join career_profiles p on p.player_uid = v.uid
  where v.url = any(p.linkedin_urls)
    and (p_ids is null or p.id = any(p_ids))
$$;

-- ---------------------------------------------------------------------------
-- Browse (no query): career profiles first, then alphabetical.
-- ---------------------------------------------------------------------------

create or replace function career_browse(
  p_locations text[] default null,
  p_div_levels text[] default null,
  p_div_names text[] default null,
  p_min_confidence real default null,
  p_verified_uids text[] default null,
  p_verified_urls text[] default null,
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
  if p_verified_uids is not null then
    v_ids := career_restrict_to_verified(v_ids, p_verified_uids, p_verified_urls);
  end if;

  if v_ids is null then
    select count(*) into v_total
    from career_profiles p
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
      and not (p.player_uid = any(p_exclude_uids));

    return query
    select p.player_uid, p.full_name, p.career_field, p."current_role", p.education,
           p.career_summary, p.confidence_score, coalesce(p.linkedin_urls, '{}'),
           career_known_locations(p.id), v_total
    from career_profiles p
    where (p.adult_from_year is null or p.adult_from_year <= v_year)
      and (p_min_confidence is null or coalesce(p.confidence_score, 0) >= p_min_confidence)
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
  p_verified_uids text[] default null,
  p_verified_urls text[] default null,
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

  if p_verified_uids is not null then
    v_filter := career_restrict_to_verified(v_filter, p_verified_uids, p_verified_urls);
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
      and not (p.player_uid = any(p_exclude_uids))
      and (v_filter is null or p.id in (select unnest(v_filter)))
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

revoke execute on function
  career_restrict_to_verified(integer[], text[], text[]),
  career_browse(text[], text[], text[], real, text[], text[], integer, text[], integer, integer),
  career_search(text, text, text, text[], text[], text[], real, text[], text[], integer, text[], integer, integer)
  from public, anon, authenticated;

grant execute on function
  career_restrict_to_verified(integer[], text[], text[]),
  career_browse(text[], text[], text[], real, text[], text[], integer, text[], integer, integer),
  career_search(text, text, text, text[], text[], text[], real, text[], text[], integer, text[], integer, integer)
  to service_role;
