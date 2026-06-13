"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";
import { ConfidenceBadge } from "@/components/careers/ConfidenceBadge";
import { confidenceLabel } from "@/lib/careers/names";

interface Candidate {
  player_uid: string;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  known_locations: string[];
  confidence_score: number | null;
}

export default function ClaimProfilePage() {
  const router = useRouter();
  const { token, authenticated, loading: authLoading } = useCareersAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!authenticated) {
      router.push("/auth/login?next=/careers/claim");
      return;
    }
    careersFetch("/api/careers/claim?suggest=true", { token })
      .then((d) => setCandidates(d.candidates || []))
      .catch(console.error);
  }, [authLoading, authenticated, token, router]);

  const handleClaim = async (player_uid: string) => {
    setClaiming(player_uid);
    setMessage("");
    try {
      await careersFetch("/api/careers/claim", {
        method: "POST",
        token,
        body: JSON.stringify({ player_uid }),
      });
      router.push("/careers/me/edit");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Claim failed");
      setClaiming(null);
    }
  };

  if (authLoading) {
    return (
      <>
        <CareersHeader authenticated={false} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-slate-500">Loading…</div>
      </>
    );
  }

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/careers" className="text-sm text-sky-600 hover:underline mb-4 inline-block">
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Claim or create your profile</h1>
        <p className="text-slate-600 text-sm mb-8">
          If we found a profile that matches your HuckHub name, you can claim it. Your name on your{" "}
          <Link href="/profile/setup" className="text-sky-600 underline">throwing profile</Link> must match to claim.
        </p>

        {candidates.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Is this you?</h2>
            <div className="space-y-3">
              {candidates.map((c) => (
                <div
                  key={c.player_uid}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{c.full_name}</p>
                    <p className="text-sm text-sky-800">
                      {[c.current_role, c.career_field].filter(Boolean).join(" · ")}
                    </p>
                    {c.known_locations.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">{c.known_locations.join(" · ")}</p>
                    )}
                    <div className="mt-2">
                      <ConfidenceBadge label={confidenceLabel(c.confidence_score, false)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={claiming === c.player_uid}
                    onClick={() => handleClaim(c.player_uid)}
                    className="bg-sky-600 hover:bg-sky-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60 shrink-0"
                  >
                    {claiming === c.player_uid ? "Claiming…" : "Claim"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {candidates.length === 0 && (
          <p className="text-slate-500 text-sm mb-8 bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
            No matching inferred profiles found for your name. You can create a new profile below.
          </p>
        )}

        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Create a new profile</h2>
          <p className="text-slate-600 text-sm mb-4">
            Not in our database yet? Build your own career profile from scratch — it will appear in search immediately.
          </p>
          <Link
            href="/careers/me/edit"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-medium px-5 py-2.5 rounded-lg"
          >
            Create my profile
          </Link>
        </section>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
      </main>
    </>
  );
}
