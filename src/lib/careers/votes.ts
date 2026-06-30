export type VoteAspect = "overall" | "linkedin";
export type VoteValue = "accurate" | "inaccurate";

export interface AspectVoteStats {
  accurate: number;
  inaccurate: number;
  total: number;
  percent_accurate: number | null;
}

export interface ProfileVoteStats {
  overall: AspectVoteStats;
  /** Per-LinkedIn-URL accuracy stats (keyed by full URL). */
  linkedin: Record<string, AspectVoteStats>;
  user_votes: {
    overall?: VoteValue;
    linkedin?: Record<string, VoteValue>;
  };
}

function emptyAspect(): AspectVoteStats {
  return { accurate: 0, inaccurate: 0, total: 0, percent_accurate: null };
}

function tallyAspect(bucket: AspectVoteStats, vote: string): void {
  if (vote === "accurate") bucket.accurate += 1;
  else if (vote === "inaccurate") bucket.inaccurate += 1;
  bucket.total = bucket.accurate + bucket.inaccurate;
  bucket.percent_accurate =
    bucket.total > 0 ? Math.round((bucket.accurate / bucket.total) * 100) : null;
}

export function buildProfileVoteStats(
  allVotes: { aspect: string; vote: string; voter_user_id: string; linkedin_url?: string | null }[],
  requestingUserId?: string,
  linkedInCandidates: string[] = []
): ProfileVoteStats {
  const overall = emptyAspect();
  const linkedin: Record<string, AspectVoteStats> = {};
  for (const url of linkedInCandidates) {
    linkedin[url] = emptyAspect();
  }

  const legacyLinkedIn = emptyAspect();
  let hasLegacyLinkedIn = false;

  for (const row of allVotes) {
    if (row.aspect === "overall") {
      tallyAspect(overall, row.vote);
      continue;
    }

    if (row.aspect !== "linkedin") continue;

    const url = row.linkedin_url?.trim();
    if (url) {
      if (!linkedin[url]) linkedin[url] = emptyAspect();
      tallyAspect(linkedin[url], row.vote);
    } else {
      hasLegacyLinkedIn = true;
      tallyAspect(legacyLinkedIn, row.vote);
    }
  }

  if (hasLegacyLinkedIn && linkedInCandidates.length === 1) {
    const url = linkedInCandidates[0];
    if (!linkedin[url]) linkedin[url] = emptyAspect();
    linkedin[url].accurate += legacyLinkedIn.accurate;
    linkedin[url].inaccurate += legacyLinkedIn.inaccurate;
    linkedin[url].total = linkedin[url].accurate + linkedin[url].inaccurate;
    linkedin[url].percent_accurate =
      linkedin[url].total > 0
        ? Math.round((linkedin[url].accurate / linkedin[url].total) * 100)
        : null;
  }

  const user_votes: ProfileVoteStats["user_votes"] = {};
  if (requestingUserId) {
    for (const row of allVotes) {
      if (row.voter_user_id !== requestingUserId) continue;
      if (row.aspect === "overall") {
        user_votes.overall = row.vote as VoteValue;
      } else if (row.aspect === "linkedin") {
        const url = row.linkedin_url?.trim();
        if (url) {
          user_votes.linkedin = user_votes.linkedin || {};
          user_votes.linkedin[url] = row.vote as VoteValue;
        } else if (linkedInCandidates.length === 1) {
          user_votes.linkedin = { [linkedInCandidates[0]]: row.vote as VoteValue };
        }
      }
    }
  }

  return { overall, linkedin, user_votes };
}
