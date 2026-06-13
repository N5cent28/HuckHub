"use client";

import { useCallback, useEffect, useState } from "react";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { ProfileCard } from "@/components/careers/ProfileCard";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";
import type { CareerSearchResult } from "@/lib/careers/types";
import Link from "next/link";
import { Search, Filter } from "lucide-react";

interface Meta {
  generated_at: string;
  n_profiles: number;
}

export default function CareersHomePage() {
  const { token, authenticated, loading: authLoading } = useCareersAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [linkedinOnly, setLinkedinOnly] = useState(false);
  const [results, setResults] = useState<CareerSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    careersFetch("/api/careers/meta").then(setMeta).catch(console.error);
    careersFetch("/api/careers/locations").then((d) => setLocations(d.locations)).catch(console.error);
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError("");
    try {
      const data = await careersFetch("/api/careers/search", {
        method: "POST",
        token,
        body: JSON.stringify({
          query: query.trim() || undefined,
          location: location.trim() || undefined,
          min_confidence: minConfidence > 0 ? minConfidence : undefined,
          linkedin_verified: linkedinOnly || undefined,
          top_k: 30,
        }),
      });
      setResults(data.results);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, location, minConfidence, linkedinOnly, token]);

  useEffect(() => {
    if (!authLoading) runSearch();
  }, [authLoading, runSearch]);

  const lastUpdated = meta?.generated_at
    ? new Date(meta.generated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <CareersHeader authenticated={authenticated} />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero / search */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-sky-950 mb-2">Find ultimate players by career</h1>
          <p className="text-slate-600 mb-6 max-w-2xl">
            Search by name, city, or field. Profiles are built from public web sources and member edits —
            always verify before reaching out.
          </p>

          {!authenticated && (
            <div className="provenance-banner rounded-lg px-4 py-3 mb-6 text-sm text-sky-900">
              <strong>Sign in</strong> to view names, LinkedIn links, and contact options.{" "}
              <Link href="/auth/login?next=/careers" className="underline font-medium">
                Create a free account
              </Link>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
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
                onClick={runSearch}
                disabled={searching}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>

            <div className={`mt-4 grid sm:grid-cols-3 gap-4 ${showFilters ? "block" : "hidden sm:grid"}`}>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
                <input
                  list="career-locations"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Min confidence ({Math.round(minConfidence * 100)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.1}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={linkedinOnly}
                    onChange={(e) => setLinkedinOnly(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  LinkedIn verified only
                </label>
              </div>
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

        {/* Results */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {query ? "Results" : "Browse"} ({results.length}
              {total > results.length ? ` of ${total}` : ""})
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
                <ProfileCard key={p.player_uid} profile={p} authenticated={authenticated} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
