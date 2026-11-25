# HuckHub Careers — Scale Architecture (50k–100k profiles)

This document describes a planned evolution from the current **in-repo JSON + NumPy bundle** (~4k profiles today) to an architecture that can serve **50k–100k profile cards** on Netlify without blowing deploy size, cold-start time, or serverless memory.

It is written for the existing stack: **Next.js on Netlify**, **Supabase** (auth + careers overrides/votes already live), and **ExpertScraper** as the upstream pipeline.

> **Status (2026-11-22): Phase B/C implemented** with the free-tier cuts (halfvec, vectors only for career text, normalized teams, unused fields dropped). Measured on Postgres 16 + pgvector 0.8 with 120.5K profiles: **87 MB** today (4.2K vectors); **246 MB** simulated at 68K career profiles (HNSW 76 MB, vectors 53 MB, profiles 51 MB, team links 30 MB). Search 35–120 ms, browse ~30–70 ms locally. Table names differ from the proposal below: `career_profiles`, `career_teams`, `career_profile_teams`, `career_profile_embeddings`. See the handoff §3 for the workflow.

---

## Current architecture (summary)

```
ExpertScraper export
  profiles.parquet  ──► prepare-careers-data.py ──► profiles.json
                                                 ──► teams.json
  embeddings.npy + embedding_ids.txt  (Stage 6, in repo)

Next.js API (Netlify serverless)
  loadCareersDataset()  → read all files into memory once per instance
  searchCareers()       → filter + O(n) dot-product over every profile
  embedText(query)      → Xenova MiniLM loaded in-process per cold instance
```

**What works at ~4k:** ~17 MB bundle, ~6 MB JSON parse, search latency is fine once warm.

**What breaks at 50k–100k:** ~300 MB+ in git/deploy, multi-second cold starts, RAM pressure, and brute-force vector scan cost — even though the scan itself is only ~100–500 ms once data is warm.

---

## What the app actually reads at runtime

| File | Read at runtime? | Purpose |
|------|------------------|---------|
| `profiles.json` | **Yes** | All profile fields for search, detail, filters |
| `teams.json` | **Yes** | Team history keyed by `player_uid` (enriched divisions) |
| `embeddings.npy` | **Yes** | 384-dim vectors aligned to `embedding_ids.txt` |
| `embedding_ids.txt` | **Yes** | Row order for `embeddings.npy` |
| `manifest.json` | **Yes** | Checksums, `generated_at`, counts |
| `profiles.parquet` | **No** | Build-time input only (`prepare-careers-data.py`) |

**Action (immediate, no schema change):** stop deploying `profiles.parquet` to Netlify. Keep it in ExpertScraper / CI artifacts only. The running app never opens it.

---

## Field audit: `profiles.parquet` / `profiles.json`

Columns in the ExpertScraper export (schema v2/v3) and whether HuckHub uses them today.

### Required for UI, search, or filters

| Field | Used for |
|-------|----------|
| `player_uid` | Primary key everywhere |
| `full_name` | Display, name search, claim matching |
| `source` | Provenance (`ultiverse` / `mufa`) |
| `career_field` | Cards, detail, keyword + semantic text |
| `current_role` | Cards, detail, keyword + semantic text |
| `education` | Detail, keyword + semantic text |
| `career_summary` | Cards, detail, blur logic, keyword + semantic text |
| `confidence_score` | Badge, min-confidence filter |
| `linkedin_url` | Detail (authenticated), votes |
| `linkedin_urls` | Up to 2 candidates, per-URL votes |
| `llm_rationale` | Detail provenance line |
| `known_locations` | Location filter + display |
| `age_min_2026` | Under-18 search exclusion |
| `age_max_2026` | (loaded; only min used for gate today) |
| `age_confidence` | Under-18 search exclusion (`high` / `medium`) |
| `playing_teams` / `coached_teams` | Team tables (via `buildProfileTeamHistory`) |

### Stored but redundant with other bundle files

| Field | Issue | Recommendation |
|-------|--------|----------------|
| `embed_source_text` | Duplicates text already encoded in `embeddings.npy` for scraped rows. Still needed for **member/admin overrides** (computed at save time in Supabase). | **Drop from scraped export**; keep only on `career_profile_overrides` / `career_admin_edits`. |
| `playing_teams` / `coached_teams` | Duplicated in `teams.json` after `prepare-careers-data.py`. | **Keep one source of truth** — prefer normalized `career_profile_teams` table or `teams.json` only, not both in profile row. |
| `linkedin_url` | Redundant with `linkedin_urls[0]` when list is present. | Keep `linkedin_urls` only; derive primary in app. |

### Pipeline / audit metadata — not shown in UI

| Field | Used in app? | Recommendation |
|-------|--------------|----------------|
| `updated_at` | No | Keep in ExpertScraper / parquet only |
| `embedded_at` | No | Keep in ExpertScraper / parquet only |
| `openalex_count` | No (always 0 today) | Drop from runtime export |
| `age_point_estimate_2026` | Loaded, never displayed or used in logic | Drop unless you add UI later |
| `age_source` | Loaded, never displayed (`league_minimum`, etc.) | Drop from runtime export |
| `linkedin_verified` | Removed in schema v2; app checks it but export has no column | Remove dead code path; use `confidence_score` only |

### Rough savings at 4k profiles (illustrative)

Stripping `embed_source_text`, timestamps, `openalex_count`, unused age fields, and **duplicate** `playing_teams` / `coached_teams` from `profiles.json` saves on the order of **~3–7 MB** today — before counting removing the separate `teams.json` duplication strategy.

At **100k profiles**, the same duplication scales linearly and matters much more than at 4k.

---

## Target architecture

Keep **Netlify** for the Next.js app and thin API routes. Move **bulk read-only profile data** to **Supabase Postgres** (you already pay $0 on free tier for modest usage). Optional **Cloudflare R2** later only if DB size or egress becomes an issue.

```
ExpertScraper (unchanged stages)
    │
    ▼
publish-careers.py  (new; replaces “commit 300MB to git”)
    │
    ├─► Supabase: career_scraped_profiles      (slim JSONB / columns)
    ├─► Supabase: career_scraped_embeddings    (vector(384) + player_uid)
    ├─► Supabase: career_scraped_teams         (player_uid, year, role, …)
    └─► Supabase: career_dataset_meta          (generated_at, model, row counts)

Next.js /api/careers/*
    ├─► Supabase SQL: filters + name search + pgvector top-K
    ├─► Merge with career_profile_overrides / career_admin_edits (existing)
    └─► Xenova embed query string only (small CPU cost; no full dataset in RAM)
```

Member-edited data **stays** in existing tables (`career_profile_overrides`, `career_admin_edits`, votes). Scraped bulk data moves to new read-only tables synced from the pipeline.

---

## Proposed Supabase schema (new tables)

### `career_dataset_meta` (single row or versioned)

```sql
create table career_dataset_meta (
  id int primary key default 1 check (id = 1),
  generated_at timestamptz not null,
  schema_version text not null,
  embedding_model text not null,
  embedding_dim int not null default 384,
  n_profiles int not null,
  n_embeddings int not null
);
```

### `career_scraped_profiles`

Slim display + filter columns. Avoid large redundant blobs.

```sql
create table career_scraped_profiles (
  player_uid text primary key,
  full_name text not null,
  source text not null,
  career_field text,
  current_role text,
  education text,
  career_summary text,
  confidence_score real,
  linkedin_urls text[] not null default '{}',
  llm_rationale text,
  known_locations text[] not null default '{}',
  age_min_2026 smallint,
  age_max_2026 smallint,
  age_confidence text,
  search_text tsvector generated always as (
    to_tsvector('english',
      coalesce(career_field,'') || ' ' ||
      coalesce(current_role,'') || ' ' ||
      coalesce(education,'') || ' ' ||
      coalesce(career_summary,'')
    )
  ) stored
);

create index idx_csp_locations on career_scraped_profiles using gin (known_locations);
create index idx_csp_name on career_scraped_profiles using gin (full_name gin_trgm_ops);
create index idx_csp_search on career_scraped_profiles using gin (search_text);
```

Enable `pg_trgm` for fuzzy name search (`%name%` / similarity).

### `career_scraped_embeddings`

```sql
create extension if not exists vector;

create table career_scraped_embeddings (
  player_uid text primary key references career_scraped_profiles(player_uid) on delete cascade,
  embedding vector(384) not null
);

-- Build after bulk load; lists = 100 is a starting point for ~100k rows
create index idx_cse_embedding on career_scraped_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

Use **cosine** distance (`<=>`) to match current dot-product on L2-normalized MiniLM vectors.

### `career_scraped_teams`

Normalized team history (replaces `teams.json`).

```sql
create table career_scraped_teams (
  id bigserial primary key,
  player_uid text not null references career_scraped_profiles(player_uid) on delete cascade,
  team_name text not null,
  year smallint not null,
  competition_level text,
  division_name text,
  team_location text,
  role text not null check (role in ('player', 'coach'))
);

create index idx_cst_uid_year on career_scraped_teams (player_uid, year desc);
create index idx_cst_division on career_scraped_teams (division_name);
```

**RLS:** enable RLS, allow `select` to `anon` and `authenticated` (public directory). Inserts/updates only via `service_role` from the publish script.

---

## Search flow (hybrid, matches today’s behavior)

### 1. Pre-filter in SQL

Apply the same rules as `passesFilters()` today:

- `known_locations` contains normalized location (or join teams for team_location)
- `division` via `career_scraped_teams.division_name` / competition_level
- `confidence_score >= min_confidence`
- Age gate: exclude where `age_confidence in ('high','medium')` and projected `age_min_2026 < 18`
- `linkedin_urls` non-empty when “LinkedIn verified only” (define as non-empty URLs + optional score threshold)

### 2. Name / keyword path (fast)

When the user types a query:

1. **Exact / strong name match** — `full_name` ILIKE or `pg_trgm` similarity; boost exact normalized match (same as current `exact_name` logic).
2. **Full-text** on career fields via `search_text @@ plainto_tsquery(...)`.

Return candidates from SQL without scanning all 100k rows in Node.

### 3. Semantic path (pgvector)

1. Embed query in API (`embedText`) — same MiniLM model as today.
2. SQL:

```sql
select p.*, 1 - (e.embedding <=> $query_vec) as semantic_score
from career_scraped_embeddings e
join career_scraped_profiles p using (player_uid)
where p.player_uid in (/* pre-filtered uids or push filters into join */)
order by e.embedding <=> $query_vec
limit 200;
```

3. Merge keyword score + semantic score in Node (same formula as today, minus confidence boost).
4. Merge overrides/admin edits from existing Supabase tables.
5. Paginate (`offset` / `limit`).

### 4. Browse (no query)

Order: member/admin overrides first (existing), then `full_name` ascending — same as current post-change behavior.

---

## Publish pipeline (replaces git data bundle)

New script: `scripts/publish-careers-to-supabase.py`

1. Read `profiles.parquet` + embeddings from ExpertScraper output (local or CI).
2. Build **slim rows** (drop unused columns in § “Pipeline metadata”).
3. `TRUNCATE` + batch `INSERT` or upsert into the three tables (use service role key).
4. `REINDEX` / `ANALYZE` ivfflat index after large loads.
5. Update `career_dataset_meta`.
6. **Do not** commit `profiles.json` / `embeddings.npy` to git at 100k scale.

Optional: keep a **small** `data/careers/` sample (e.g. 200 profiles) in git for local dev and Playwright tests.

---

## Netlify app changes (phased)

### Phase A — Quick wins (before 20k)

- [ ] Remove `profiles.parquet` from deploy artifact.
- [ ] Slim `prepare-careers-data.py` output (drop unused columns).
- [ ] Deduplicate teams: either inline in profile **or** `teams.json`, not both.
- [ ] Add `export const dynamic = 'force-dynamic'` on careers routes (already on search).

### Phase B — Supabase read path (target: 50k+)

- [ ] Add migrations for new tables + `vector` extension.
- [ ] Implement `src/lib/careers/db-scraped.ts` (load profile, teams, search).
- [ ] Feature flag: `CAREERS_DATA_SOURCE=supabase|bundle` for gradual cutover.
- [ ] `/api/careers/meta`, `/locations`, `/divisions` read from SQL aggregates.

### Phase C — Decommission in-repo bundle

- [ ] Remove `loadCareersDataset()` filesystem loader from production path.
- [ ] Git LFS / R2 only if you want offline backups — not required for runtime.

### Phase D — Polish at 100k

- [ ] Tune ivfflat `lists` / `probes` (or migrate to HNSW if Supabase version supports it).
- [ ] Cache hot location/division facet lists in edge or short TTL memory.
- [ ] Consider query-embedding cache (hash query string → vector) in Supabase KV or in-memory per instance.

---

## Cost estimate (Supabase-first, minimal spend)

Figures are order-of-magnitude for **~100k profiles**.

| Resource | Size estimate |
|----------|----------------|
| Profile rows (slim) | ~50–80 MB |
| Vectors (100k × 384 × 4 bytes) | ~150 MB |
| Teams (varies) | ~30–80 MB |
| Indexes (GIN + ivfflat) | ~50–100 MB |
| **Total DB** | **~300–400 MB** |

| Tier | Monthly | Fit |
|------|---------|-----|
| **Supabase Free** | $0 | 500 MB database limit — **tight but possible** with slim schema and no extra bloat. Good for testing 100k. |
| **Supabase Pro** | ~$25 | 8 GB included — comfortable headroom, daily backups, no pause. Recommended before public launch at full scale. |

**Not needed initially:** Pinecone, Elasticsearch, separate vector DB. pgvector in the project you already use keeps payment minimal and merges cleanly with overrides/votes.

**Netlify:** unchanged plan; functions become thinner (no 300 MB read on cold start). Main cost is still your existing site tier.

**Optional R2 (~$0–2/mo):** store parquet + `.npy` as publish pipeline artifacts only, not served to users.

---

## What stays the same

- UI routes (`/careers`, profile detail, claim, votes).
- Auth + `career_profile_overrides` / votes / admin edits (existing migrations).
- ExpertScraper stages 5–6 (LLM + embeddings).
- MiniLM model for **query** embedding in the API.
- Age gating, confidence filter slider, URL-based search state.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Bulk publish locks tables | Publish to `career_scraped_*_staging`, swap view or rename in one transaction |
| ivfflat recall &lt; 100% | Increase `probes` at query time; re-tune `lists` after growth |
| Cold start still loads Xenova | Acceptable; model is ~20–80 MB once per instance — much smaller than full dataset |
| Free tier DB pause | Upgrade to Pro before marketing push at 100k |
| Name search edge cases (`Last, First`) | Keep `normalizeDisplayName` in API; optional generated `full_name_normalized` column |

---

## Success metrics

| Scale | Target |
|-------|--------|
| 4k (today) | p95 search &lt; 500 ms warm |
| 50k | p95 search &lt; 800 ms; deploy artifact &lt; 50 MB (no bulk data in git) |
| 100k | p95 search &lt; 1.2 s; DB &lt; 500 MB on slim schema; zero O(n) Node scan |

---

## Recommended order of work

1. **This week:** slim export + drop parquet from deploy (no Supabase migration yet).
2. **Before 20k indexed:** add Supabase tables + publish script; dual-read behind flag.
3. **Before 50k:** cut over search/detail to Supabase; remove bundle from production.
4. **At 100k:** index tuning + Pro tier if still on free.

---

## Related files (today)

| Path | Role |
|------|------|
| `src/lib/careers/loader.ts` | Filesystem bundle loader (to replace) |
| `src/lib/careers/search.ts` | Filter + score logic (reuse in hybrid SQL flow) |
| `src/lib/careers/db.ts` | Overrides/admin load (keep) |
| `scripts/prepare-careers-data.py` | Parquet → JSON/teams (evolve → publish script) |
| `data/careers/*` | Runtime bundle (shrink → dev sample only) |

---

*Last updated: 2026-06-12 — reflects app at ~4.2k profiles on `main`.*
