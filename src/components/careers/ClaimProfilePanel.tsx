"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { careersFetch } from "@/lib/careers/client";

/**
 * Claim flow: link "Sign in with LinkedIn" to the HuckHub account (once), add
 * an optional LinkedIn profile link, then claim. The server checks that both
 * the HuckHub name and the LinkedIn account name match the profile.
 */
export function ClaimProfilePanel({
  playerUid,
  token,
  onClaimed,
  onAlreadyClaimed,
  onCancel,
}: {
  playerUid: string;
  token: string | null;
  onClaimed: (message: string) => void;
  onAlreadyClaimed: (message: string) => void;
  onCancel: () => void;
}) {
  const [linkedInName, setLinkedInName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth
      .getUserIdentities()
      .then(({ data }) => {
        const li = data?.identities?.find((i) => i.provider === "linkedin_oidc");
        const d = (li?.identity_data || {}) as Record<string, string | undefined>;
        setLinkedInName(li ? d.name || [d.given_name, d.family_name].filter(Boolean).join(" ") || "LinkedIn" : null);
      })
      .catch(() => setLinkedInName(null))
      .finally(() => setChecking(false));
  }, []);

  const verifyWithLinkedIn = async () => {
    setError("");
    const redirectTo = `${window.location.origin}/careers/profile/${encodeURIComponent(playerUid)}?claim=1`;
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "linkedin_oidc",
      options: { redirectTo },
    });
    if (linkError) setError(linkError.message);
  };

  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await careersFetch("/api/careers/claim", {
        method: "POST",
        token,
        body: JSON.stringify({ player_uid: playerUid, linkedin_url: linkedinUrl.trim() || undefined }),
      });
      onClaimed(String(data.message));
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "already_claimed") onAlreadyClaimed(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-sky-200 rounded-lg p-4 bg-sky-50 space-y-3">
      <h3 className="font-semibold text-sky-950 text-sm">Claim this profile</h3>
      <p className="text-sm text-sky-900">
        To keep profiles safe, claiming needs your HuckHub name and your LinkedIn account name to match this profile.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-sky-900">1. LinkedIn</span>
        {checking ? (
          <span className="text-xs text-slate-500">Checking…</span>
        ) : linkedInName ? (
          <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
            Verified as {linkedInName}
          </span>
        ) : (
          <button
            type="button"
            onClick={verifyWithLinkedIn}
            className="text-sm bg-[#0A66C2] text-white px-3 py-1.5 rounded-lg hover:opacity-90"
          >
            Verify with LinkedIn
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-sky-900 mb-1">
          2. Your LinkedIn profile link (optional, helps teammates find you)
        </label>
        <input
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/your-name"
          className="w-full border border-sky-200 rounded-lg px-2 py-1.5 text-sm bg-white"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={claim}
          disabled={busy || checking}
          className="text-sm bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {busy ? "Claiming…" : "3. Claim profile"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-600 px-3 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
