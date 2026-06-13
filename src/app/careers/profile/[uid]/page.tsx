"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { ConfidenceBadge } from "@/components/careers/ConfidenceBadge";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";
import { confidenceLabel } from "@/lib/careers/names";
import type { TeamEntry } from "@/lib/careers/types";
import { ExternalLink, Flag, UserCheck } from "lucide-react";

interface ProfileDetail {
  player_uid: string;
  full_name: string | null;
  name_blurred: boolean;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  known_locations: string[];
  teams: TeamEntry[];
  confidence_score: number | null;
  linkedin_verified: boolean;
  linkedin_url: string | null;
  llm_rationale: string | null;
  provenance: string;
  is_user_edited: boolean;
  open_to_career_chats: boolean;
  email: string | null;
  can_claim: boolean;
}

export default function CareerProfilePage() {
  const params = useParams();
  const uid = decodeURIComponent(params.uid as string);
  const { token, authenticated } = useCareersAuth();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState("");

  useEffect(() => {
    careersFetch(`/api/careers/profile/${encodeURIComponent(uid)}`, { token })
      .then((d) => setProfile(d.profile))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid, token]);

  const handleClaim = async () => {
    setClaiming(true);
    setMessage("");
    try {
      const data = await careersFetch("/api/careers/claim", {
        method: "POST",
        token,
        body: JSON.stringify({ player_uid: uid }),
      });
      setMessage(data.message);
      window.location.href = "/careers/me/edit";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleReport = async () => {
    try {
      await careersFetch("/api/careers/report-impersonation", {
        method: "POST",
        token,
        body: JSON.stringify({ reported_player_uid: uid, message: reportMsg }),
      });
      setMessage("Report submitted. Thank you.");
      setReportOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Report failed");
    }
  };

  if (loading) {
    return (
      <>
        <CareersHeader authenticated={authenticated} />
        <div className="max-w-3xl mx-auto px-4 py-16 text-slate-500">Loading profile…</div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <CareersHeader authenticated={authenticated} />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-600 mb-4">Profile not found.</p>
          <Link href="/careers" className="text-sky-600 hover:underline">Back to search</Link>
        </div>
      </>
    );
  }

  const confLabel = confidenceLabel(profile.confidence_score, profile.is_user_edited);

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/careers" className="text-sm text-sky-600 hover:underline mb-6 inline-block">
          ← Back to search
        </Link>

        <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-8 border-b border-slate-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {authenticated && profile.full_name ? (
                    profile.full_name
                  ) : (
                    <span className="blur-md select-none bg-slate-200 text-transparent rounded px-4 inline-block">
                      Hidden Name
                    </span>
                  )}
                </h1>
                {(profile.current_role || profile.career_field) && (
                  <p className="text-sky-800 font-medium mt-1">
                    {[profile.current_role, profile.career_field].filter(Boolean).join(" · ")}
                  </p>
                )}
                {profile.known_locations.length > 0 && (
                  <p className="text-slate-500 text-sm mt-1">{profile.known_locations.join(" · ")}</p>
                )}
              </div>
              <ConfidenceBadge label={confLabel} />
            </div>

            {!authenticated && (
              <p className="mt-4 text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                <Link href={`/auth/login?next=/careers/profile/${encodeURIComponent(uid)}`} className="font-medium underline">
                  Sign in
                </Link>{" "}
                to view this person&apos;s name, LinkedIn, and contact options.
              </p>
            )}
          </div>

          <div className="px-6 py-6 space-y-6">
            {profile.career_summary && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">About</h2>
                <p className="text-slate-700 leading-relaxed">{profile.career_summary}</p>
              </section>
            )}

            {profile.education && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Education</h2>
                <p className="text-slate-700">{profile.education}</p>
              </section>
            )}

            {profile.teams.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Ultimate teams</h2>
                <ul className="space-y-2">
                  {profile.teams.slice(0, 12).map((t, i) => (
                    <li key={i} className="text-sm text-slate-700 flex flex-wrap gap-x-2">
                      <span className="font-medium">{t.team_name}</span>
                      <span className="text-slate-400">{t.year}</span>
                      {t.team_location && <span className="text-slate-500">· {t.team_location}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {authenticated && (
              <section className="flex flex-wrap gap-3 pt-2">
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm bg-[#0A66C2] text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {profile.open_to_career_chats && (
                  <span className="inline-flex items-center gap-1.5 text-sm bg-sky-100 text-sky-800 px-4 py-2 rounded-lg">
                    Open to career chats
                  </span>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="text-sm border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50">
                    {profile.email}
                  </a>
                )}
              </section>
            )}

            {profile.provenance === "inferred" && profile.llm_rationale && (
              <section className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm">
                <h2 className="font-semibold text-amber-900 mb-1">Data provenance</h2>
                <p className="text-amber-800 mb-2">
                  This profile was inferred from public web sources, not verified by HuckHub. It may be incomplete or incorrect.
                </p>
                <p className="text-amber-700 italic">{profile.llm_rationale}</p>
              </section>
            )}

            {message && (
              <p className="text-sm text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">{message}</p>
            )}

            {authenticated && profile.can_claim && (
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                {claiming ? "Claiming…" : "Is this you? Claim this profile"}
              </button>
            )}

            {authenticated && !profile.is_user_edited && (
              <div>
                {!reportOpen ? (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
                  >
                    <Flag className="h-3.5 w-3.5" /> This person is impersonating me
                  </button>
                ) : (
                  <div className="border border-red-100 rounded-lg p-4 bg-red-50">
                    <p className="text-sm text-red-800 mb-2">Tell us why this profile doesn&apos;t represent you:</p>
                    <textarea
                      value={reportMsg}
                      onChange={(e) => setReportMsg(e.target.value)}
                      className="w-full border border-red-200 rounded-lg p-2 text-sm mb-2"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleReport} className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg">
                        Submit report
                      </button>
                      <button type="button" onClick={() => setReportOpen(false)} className="text-sm text-slate-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
      </main>
    </>
  );
}
