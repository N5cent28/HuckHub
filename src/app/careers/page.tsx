"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { ProfileCard } from "@/components/careers/ProfileCard";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";
import {
  buildCareersSearchQuery,
  parseCareersSearchParams,
} from "@/lib/careers/search-params";
import type { CareerSearchResult } from "@/lib/careers/types";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 30;

interface Meta {
  generated_at: string;
  n_profiles: number;
}

function CareersSearchContent() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const { token, authenticated, loading: authLoading } = useCareersAuth();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [division, setDivision] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [linkedinOnly, setLinkedinOnly] = useState(false);
  const [results, setResults] = useState<CareerSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState("");

  const skipUrlSync = useRef(false);
  const lastFetched = useRef("");

  // Restore filters from URL (browser back, shared links, return from profile)
  useEffect(() => {
    const parsed = parseCareersSearchParams(urlParams);
    skipUrlSync.current = true;
    setQuery(parsed.query);
    setLocation(parsed.location);
    setDivision(parsed.division);
    setMinConfidence(parsed.minConfidence);
    setLinkedinOnly(parsed.linkedinOnly);
    setPage(parsed.page);
  }, [urlParams]);

  useEffect(() => {
    careersFetch("/api/careers/meta").then(setMeta).catch(console.error);
    careersFetch("/api/careers/locations").then((d) => setLocations(d.locations)).catch(console.error);
    careersFetch("/api/careers/divisions").then((d) => setDivisions(d.divisions)).catch(console.error);
  }, []);

  const runSearch = useCallback(
    async (pageIndex: number, criteria?: {
      query: string;
      location: string;
      division: string;
      minConfidence: number;
      linkedinOnly: boolean;
    }) => {
      const q = criteria?.query ?? query;
      const loc = criteria?.location ?? location;
      const div = criteria?.division ?? division;
      const conf = criteria?.minConfidence ?? minConfidence;
      const linkedin = criteria?.linkedinOnly ?? linkedinOnly;

      const fetchKey = JSON.stringify({
        q: q.trim(),
        loc: loc.trim(),
        div: div.trim(),
        conf,
        linkedin,
        pageIndex,
        token,
      });
      if (fetchKey === lastFetched.current) return;
      lastFetched.current = fetchKey;

      if (!skipUrlSync.current) {
        const qs = buildCareersSearchQuery({
          query: q,
          location: loc,
          division: div,
          minConfidence: conf,
          linkedinOnly: linkedin,
          page: pageIndex,
        });
        router.replace(qs ? `/careers?${qs}` : "/careers", { scroll: false });
      }
      skipUrlSync.current = false;

      setSearching(true);
      setError("");
      try {
        const data = await careersFetch("/api/careers/search", {
          method: "POST",
          token,
          body: JSON.stringify({
            query: q.trim() || undefined,
            location: loc.trim() || undefined,
            division: div.trim() || undefined,
            min_confidence: conf > 0 ? conf : undefined,
            linkedin_verified: linkedin || undefined,
            offset: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
          }),
        });
        setResults(data.results as CareerSearchResult[]);
        setTotal(data.total as number);
        setHasMore(data.has_more as boolean);
        setPage(pageIndex);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setSearching(false);
      }
    },
    [query, location, division, minConfidence, linkedinOnly, token, router]
  );

  const runSearchFromStart = useCallback(() => {
    lastFetched.current = "";
    runSearch(0);
  }, [runSearch]);

  useEffect(() => {
    if (authLoading) return;
    runSearch(page);
  }, [authLoading, query, location, division, minConfidence, linkedinOnly, page, token, runSearch]);

  const returnQuery = buildCareersSearchQuery({
    query,
    location,
    division,
    minConfidence,
    linkedinOnly,
    page,
  });

  const lastUpdated = meta?.generated_at
    ? new Date(meta.generated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <CareersHeader authenticated={authenticated} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-sky-950 mb-2">Find ultimate players by career</h1>
          <p className="text-slate-600 mb-6 max-w-2xl">
            Search by name, city, or field. Profiles are built from public web sources and member edits —
            always verify before reaching out.
          </p>

          {!authenticated && (
            <p className="text-xs text-slate-500 mb-4">
              Hover blurred names to learn more ·{" "}
              <Link href="/auth/login?next=/careers" className="text-sky-600 hover:underline font-medium">
                Sign in
              </Link>{" "}
              for full profiles
            </p>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    lastFetched.current = "";
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && runSearchFromStart()}
                  placeholder="Name, city, or career field…"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700"
              >
                <Filter className="h-4 w-4" /> Filters
              </button>
              <button
                type="button"
                onClick={runSearchFromStart}
                disabled={searching}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>

            <div className={`mt-4 space-y-4 ${showFilters ? "block" : "hidden sm:block"}`}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
                  <input
                    list="career-locations"
                    value={location}
                    onChange={(e) => {
                      lastFetched.current = "";
                      setLocation(e.target.value);
                      setPage(0);
                    }}
                    placeholder="e.g. Madison"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <datalist id="career-locations">
                    {locations.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Division</label>
                  <select
                    value={division}
                    onChange={(e) => {
                      lastFetched.current = "";
                      setDivision(e.target.value);
                      setPage(0);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">All divisions</option>
                    {divisions.map((div) => (
                      <option key={div} value={div}>
                        {div}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Min confidence ({Math.round(minConfidence * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.1}
                    value={minConfidence}
                    onChange={(e) => {
                      lastFetched.current = "";
                      setMinConfidence(parseFloat(e.target.value));
                      setPage(0);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={linkedinOnly}
                  onChange={(e) => {
                    lastFetched.current = "";
                    setLinkedinOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-slate-300 text-sky-600"
                />
                LinkedIn verified only
              </label>
            </div>
          </div>

          {meta && (
            <p className="text-xs text-slate-400 mt-3">
              {meta.n_profiles.toLocaleString()} indexed profiles
              {lastUpdated && ` · Last updated ${lastUpdated}`}
            </p>
          )}
        </section>

        {error && (
          <div className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {query ? "Results" : "Browse"}
              {total > 0 && (
                <span className="text-slate-500 font-normal text-base ml-1">
                  ({pageStart}–{pageEnd} of {total})
                </span>
              )}
            </h2>
            {authenticated && (
              <Link href="/careers/claim" className="text-sm text-sky-600 hover:underline">
                Claim or create profile
              </Link>
            )}
          </div>

          {results.length === 0 && !searching ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
              No profiles match your search. Try a broader query or lower the confidence filter.
            </div>
          ) : (
            <div className="grid gap-3">
              {results.map((p) => (
                <ProfileCard
                  key={p.player_uid}
                  profile={p}
                  authenticated={authenticated}
                  returnQuery={returnQuery}
                />
              ))}
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0 || searching}
                  onClick={() => {
                    lastFetched.current = "";
                    setPage((p) => Math.max(0, p - 1));
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  type="button"
                  disabled={!hasMore || searching}
                  onClick={() => {
                    lastFetched.current = "";
                    setPage((p) => p + 1);
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default function CareersHomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Loading search…
        </div>
      }
    >
      <CareersSearchContent />
    </Suspense>
  );
}
