"use client";

import { useState } from "react";
import { careersFetch } from "@/lib/careers/client";
import { linkedInCandidateLabel } from "@/lib/careers/linkedin";
import type { ProfileVoteStats, VoteAspect, VoteValue } from "@/lib/careers/votes";
import { ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";

function VoteStatLine({
  label,
  stats,
}: {
  label: string;
  stats: { percent_accurate: number | null; total: number };
}) {
  if (stats.total === 0) return null;
  return (
    <p className="text-xs text-slate-500">
      <span className="font-medium text-slate-700">{stats.percent_accurate}%</span> of {stats.total}{" "}
      {stats.total === 1 ? "review" : "reviews"} — {label}
    </p>
  );
}

function VoteButtons({
  current,
  disabled,
  onVote,
}: {
  current?: VoteValue;
  disabled: boolean;
  onVote: (vote: VoteValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote("accurate")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors ${
          current === "accurate"
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <ThumbsUp className="h-3 w-3" /> Right
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote("inaccurate")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors ${
          current === "inaccurate"
            ? "bg-red-50 border-red-300 text-red-800"
            : "border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <ThumbsDown className="h-3 w-3" /> Wrong
      </button>
    </div>
  );
}

function VoteRow({
  label,
  stats,
  statLabel,
  current,
  disabled,
  onVote,
  showSignInHint,
}: {
  label: string;
  stats: { percent_accurate: number | null; total: number };
  statLabel?: string;
  current?: VoteValue;
  disabled: boolean;
  onVote: (vote: VoteValue) => void;
  showSignInHint?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
      <div className="min-w-0">
        <p className="text-xs text-slate-700">{label}</p>
        <VoteStatLine label={statLabel ?? label.toLowerCase()} stats={stats} />
      </div>
      {showSignInHint ? (
        <p className="text-xs text-slate-400 shrink-0">Sign in to vote</p>
      ) : (
        <VoteButtons current={current} disabled={disabled} onVote={onVote} />
      )}
    </div>
  );
}

export function ProfileCommunityVotes({
  playerUid,
  token,
  authenticated,
  linkedinUrls,
  initialStats,
}: {
  playerUid: string;
  token: string | null;
  authenticated: boolean;
  linkedinUrls: string[];
  initialStats: ProfileVoteStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [voting, setVoting] = useState(false);
  const [message, setMessage] = useState("");

  const handleVote = async (
    aspect: VoteAspect,
    vote: VoteValue,
    linkedinUrl?: string
  ) => {
    if (!authenticated || !token) return;
    setVoting(true);
    setMessage("");
    try {
      const data = await careersFetch("/api/careers/votes", {
        method: "POST",
        token,
        body: JSON.stringify({
          player_uid: playerUid,
          aspect,
          vote,
          linkedin_url: linkedinUrl,
        }),
      });
      setStats(data.stats as ProfileVoteStats);
      setMessage(data.message as string);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save vote");
    } finally {
      setVoting(false);
    }
  };

  const multipleCandidates = linkedinUrls.length > 1;
  const singleLinkedIn = linkedinUrls.length === 1;

  return (
    <section className="border border-slate-200 rounded-lg p-3 space-y-3">
      <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        Community accuracy
      </h2>

      <VoteRow
        label="Overall profile"
        stats={stats.overall}
        statLabel="this profile looks accurate"
        current={stats.user_votes.overall}
        disabled={voting}
        onVote={(vote) => handleVote("overall", vote)}
        showSignInHint={!authenticated}
      />

      {linkedinUrls.length > 0 && (
        <>
          {multipleCandidates && (
            <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">
              Multiple LinkedIn matches — vote on each separately.
            </p>
          )}

          <div
            className={
              singleLinkedIn
                ? "border-t border-slate-100 pt-2"
                : `grid gap-3 pt-2 border-t border-slate-100 ${
                    linkedinUrls.length > 1 ? "sm:grid-cols-2" : ""
                  }`
            }
          >
            {linkedinUrls.map((url, index) => {
              const urlStats = stats.linkedin[url] || {
                accurate: 0,
                inaccurate: 0,
                total: 0,
                percent_accurate: null,
              };
              const label = linkedInCandidateLabel(url, index);
              const voteLabel = multipleCandidates
                ? `LinkedIn candidate ${index + 1} (${label})`
                : "LinkedIn match";

              if (singleLinkedIn) {
                return (
                  <div
                    key={url}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-[#0A66C2] text-white px-3 py-1.5 rounded-md hover:opacity-90"
                      >
                        {label} <ExternalLink className="h-3 w-3" />
                      </a>
                      <VoteStatLine label={`${label} is the right person`} stats={urlStats} />
                    </div>
                    {authenticated ? (
                      <VoteButtons
                        current={stats.user_votes.linkedin?.[url]}
                        disabled={voting}
                        onVote={(vote) => handleVote("linkedin", vote, url)}
                      />
                    ) : (
                      <p className="text-xs text-slate-400 shrink-0">Sign in to vote</p>
                    )}
                  </div>
                );
              }

              return (
                <div key={url} className="rounded-md border border-slate-100 p-2.5 space-y-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs bg-[#0A66C2] text-white px-3 py-1.5 rounded-md hover:opacity-90"
                  >
                    {label} <ExternalLink className="h-3 w-3" />
                  </a>
                  <VoteRow
                    label={voteLabel}
                    stats={urlStats}
                    current={stats.user_votes.linkedin?.[url]}
                    disabled={voting}
                    onVote={(vote) => handleVote("linkedin", vote, url)}
                    showSignInHint={!authenticated}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {message && <p className="text-xs text-sky-700">{message}</p>}
    </section>
  );
}
