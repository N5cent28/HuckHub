"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { ProfileConfidence } from "@/components/careers/ProfileConfidence";
import { BlurredName, BlurredSummary } from "@/components/careers/BlurredText";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";
import { formatTeamDivision } from "@/lib/careers/teams";
import { ProfileCommunityVotes } from "@/components/careers/ProfileCommunityVotes";
import type { ProfileVoteStats } from "@/lib/careers/votes";
import type { TeamEntry } from "@/lib/careers/types";
import { UserCheck, Pencil } from "lucide-react";

type TeamRow = TeamEntry & { division: string | null };

function TeamHistoryTable({ title, teams }: { title: string; teams: TeamRow[] }) {
  if (teams.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Division</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teams.map((t, i) => (
              <tr key={`${t.team_name}-${t.year}-${i}`} className="text-slate-700">
                <td className="px-3 py-2 font-medium">{t.team_name}</td>
                <td className="px-3 py-2 text-slate-500 tabular-nums">{t.year}</td>
                <td className="px-3 py-2 text-sky-800">{t.division || "—"}</td>
                <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">
                  {t.team_location || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ProfileDetail {
  player_uid: string;
  full_name: string | null;
  name_blurred: boolean;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  career_summary_name_prefix: string | null;
  known_locations: string[];
  teams_played: TeamEntry[];
  teams_coached: TeamEntry[];
  confidence_score: number | null;
  linkedin_verified: boolean;
  linkedin_url: string | null;
  linkedin_urls: string[];
  llm_rationale: string | null;
  provenance: string;
  is_user_edited: boolean;
  is_admin_edited: boolean;
  open_to_career_chats: boolean;
  email: string | null;
  can_claim: boolean;
  can_attempt_claim: boolean;
  claimed_by_other: boolean;
  vote_stats: ProfileVoteStats;
  is_admin: boolean;
}

function CareerProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const uid = decodeURIComponent(params.uid as string);
  const fromQuery = searchParams.get("from");
  const backHref = fromQuery ? `/careers?${fromQuery}` : "/careers";
  const { token, authenticated } = useCareersAuth();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeMsg, setDisputeMsg] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  useEffect(() => {
    careersFetch(`/api/careers/profile/${encodeURIComponent(uid)}`, { token })
      .then((d) => setProfile(d.profile))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid, token]);

  const handleClaim = async () => {
    setClaiming(true);
    setMessage("");
    setShowDisputeForm(false);
    try {
      const data = await careersFetch("/api/careers/claim", {
        method: "POST",
        token,
        body: JSON.stringify({ player_uid: uid }),
      });
      setMessage(data.message);
      window.location.href = "/careers/me/edit";
    } catch (e) {
      const err = e as Error & { code?: string; can_dispute?: boolean };
      if (err.code === "already_claimed" && err.can_dispute) {
        setShowDisputeForm(true);
        setMessage(
          "Another member has already claimed this profile. If this is really you, submit a dispute and we will review it."
        );
      } else {
        setMessage(err.message);
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeMsg.trim()) {
      setMessage("Please explain why this profile belongs to you.");
      return;
    }
    setSubmittingDispute(true);
    setMessage("");
    try {
      const data = await careersFetch("/api/careers/report-impersonation", {
        method: "POST",
        token,
        body: JSON.stringify({
          reported_player_uid: uid,
          message: disputeMsg.trim(),
          evidence_notes: evidenceNotes.trim() || undefined,
        }),
      });
      setMessage(data.message);
      setShowDisputeForm(false);
      setDisputeMsg("");
      setEvidenceNotes("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Dispute submission failed");
    } finally {
      setSubmittingDispute(false);
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
          <Link href={backHref} className="text-sky-600 hover:underline">Back to search</Link>
        </div>
      </>
    );
  }

  const adminEditHref = `/careers/admin/edit/${encodeURIComponent(uid)}${fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : ""}`;

  const teamsPlayed = profile.teams_played
    .slice(0, 15)
    .map((t) => ({ ...t, division: formatTeamDivision(t) }));
  const teamsCoached = profile.teams_coached
    .slice(0, 15)
    .map((t) => ({ ...t, division: formatTeamDivision(t) }));

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href={backHref} className="text-sm text-sky-600 hover:underline mb-6 inline-block">
          ← Back to search
        </Link>

        <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-50 to-white px-6 py-8 border-b border-slate-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {authenticated ? (
                    profile.full_name
                  ) : (
                    <BlurredName name={profile.full_name} className="text-2xl" />
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
              <ProfileConfidence
                score={profile.confidence_score}
                isUserEdited={profile.is_user_edited}
                isAdminEdited={profile.is_admin_edited}
              />
            </div>

            {!authenticated && (
              <p className="mt-4 text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                <Link href={`/auth/login?next=/careers/profile/${encodeURIComponent(uid)}`} className="font-medium underline">
                  Sign in
                </Link>{" "}
                to view this person&apos;s name clearly, LinkedIn, and contact options.
              </p>
            )}
          </div>

          <div className="px-6 py-6 space-y-6">
            {profile.career_summary && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">About</h2>
                <p className="text-slate-700 leading-relaxed">
                  <BlurredSummary
                    summary={profile.career_summary}
                    namePrefix={authenticated ? null : profile.career_summary_name_prefix}
                  />
                </p>
              </section>
            )}

            {profile.education && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Education</h2>
                <p className="text-slate-700">{profile.education}</p>
              </section>
            )}

            <TeamHistoryTable title="Teams played for" teams={teamsPlayed} />
            <TeamHistoryTable title="Teams coached" teams={teamsCoached} />

            {authenticated && (profile.open_to_career_chats || profile.email) && (
              <section className="flex flex-wrap gap-3 pt-2">
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

            <ProfileCommunityVotes
              playerUid={uid}
              token={token}
              authenticated={authenticated}
              linkedinUrls={profile.linkedin_urls}
              initialStats={profile.vote_stats}
            />

            {profile.provenance === "inferred" && profile.llm_rationale && (
              <p className="text-xs text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
                <span className="text-slate-500">Inferred from public sources</span>
                {" · "}
                {profile.llm_rationale}
              </p>
            )}

            {profile.is_admin && (
              <Link
                href={adminEditHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 px-4 py-2 rounded-lg hover:bg-violet-100"
              >
                <Pencil className="h-4 w-4" /> Admin: edit this profile
              </Link>
            )}

            {message && (
              <p className="text-sm text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">{message}</p>
            )}

            {authenticated && profile.can_attempt_claim && !showDisputeForm && (
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

            {authenticated && showDisputeForm && (
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3">
                <h3 className="font-semibold text-amber-900 text-sm">Dispute this profile claim</h3>
                <p className="text-sm text-amber-800">
                  Tell us why you are the rightful owner. You may describe ID you can provide (driver&apos;s license,
                  university ID, etc.) — we may contact you at your account email to verify.
                </p>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Why is this your profile?</label>
                  <textarea
                    value={disputeMsg}
                    onChange={(e) => setDisputeMsg(e.target.value)}
                    className="w-full border border-amber-200 rounded-lg p-2 text-sm bg-white"
                    rows={3}
                    placeholder="I am this person because…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    Evidence you can provide (optional)
                  </label>
                  <textarea
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    className="w-full border border-amber-200 rounded-lg p-2 text-sm bg-white"
                    rows={2}
                    placeholder="e.g. Wisconsin driver's license, UW-Madison student ID, LinkedIn matching my HuckHub name…"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDispute}
                    disabled={submittingDispute}
                    className="text-sm bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {submittingDispute ? "Submitting…" : "Submit dispute for review"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="text-sm text-slate-600 px-3 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>
      </main>
    </>
  );
}

export default function CareerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Loading profile…
        </div>
      }
    >
      <CareerProfileContent />
    </Suspense>
  );
}
