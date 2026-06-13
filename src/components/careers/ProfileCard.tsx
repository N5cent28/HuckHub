import Link from "next/link";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { CareerSearchResult } from "@/lib/careers/types";

export function ProfileCard({
  profile,
  authenticated,
}: {
  profile: CareerSearchResult;
  authenticated: boolean;
}) {
  return (
    <Link
      href={`/careers/profile/${encodeURIComponent(profile.player_uid)}`}
      className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-sky-300 hover:shadow-md transition-all"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-900 text-lg">
          {authenticated && profile.full_name ? (
            profile.full_name
          ) : (
            <span className="select-none blur-sm bg-slate-200 text-transparent rounded px-2" aria-hidden>
              Hidden Name
            </span>
          )}
          {!authenticated && (
            <span className="sr-only">Name hidden — sign in to view</span>
          )}
        </h3>
        <ConfidenceBadge label={profile.confidence_label} />
      </div>

      {(profile.current_role || profile.career_field) && (
        <p className="text-sky-800 font-medium text-sm mb-1">
          {[profile.current_role, profile.career_field].filter(Boolean).join(" · ")}
        </p>
      )}

      {profile.known_locations.length > 0 && (
        <p className="text-slate-500 text-sm mb-2">{profile.known_locations.join(" · ")}</p>
      )}

      {profile.career_summary && (
        <p className="text-slate-600 text-sm line-clamp-2">{profile.career_summary}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-400">
        {profile.provenance === "inferred" && <span>Inferred from public sources</span>}
        {profile.is_user_edited && <span>Edited by member</span>}
        {profile.open_to_career_chats && authenticated && (
          <span className="text-sky-600">Open to career chats</span>
        )}
      </div>
    </Link>
  );
}
