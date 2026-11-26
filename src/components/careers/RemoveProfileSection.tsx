"use client";

import { useState } from "react";
import Link from "next/link";
import { careersFetch } from "@/lib/careers/client";

/**
 * "Don't want to be listed?" (sign-in required). Owners (claimed, or HuckHub
 * name matches) get one instant removal per account; anything else becomes a
 * request an admin reviews. Owners can also release a claim that isn't them.
 */
export function RemoveProfileSection({
  playerUid,
  token,
  authenticated,
  isOwner,
}: {
  playerUid: string;
  token: string | null;
  authenticated: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ done: boolean; message: string } | null>(null);
  const [error, setError] = useState("");

  if (!authenticated) {
    return (
      <p className="text-xs text-slate-400">
        Is this you and you&apos;d rather not be listed?{" "}
        <Link
          href={`/auth/login?next=/careers/profile/${encodeURIComponent(playerUid)}`}
          className="underline hover:text-slate-600"
        >
          Sign in to request removal
        </Link>
      </p>
    );
  }

  const run = async (path: string, init: RequestInit, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await careersFetch(path, { ...init, token });
      setResult({ done: data.removed !== false, message: String(data.message) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = () =>
    run(
      "/api/careers/remove",
      { method: "POST", body: JSON.stringify({ player_uid: playerUid, message: message.trim() || undefined }) },
      isOwner
        ? "Remove your profile from HuckHub Careers? It will no longer appear in search."
        : "Request removal of this profile?"
    );

  const release = () =>
    run(
      "/api/careers/claim",
      { method: "DELETE" },
      "Release your claim on this profile? Your edits are deleted and it goes back to its original listing. This counts toward your account's claim limit."
    );

  if (result) {
    return (
      <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        {result.message}{" "}
        {result.done && (
          <a href="/careers" className="text-sky-600 underline">
            Back to search
          </a>
        )}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-slate-400 hover:text-slate-600 underline">
          {isOwner ? "Remove my profile from HuckHub Careers" : "Is this you and you'd rather not be listed? Request removal"}
        </button>
        {isOwner && (
          <button type="button" onClick={release} disabled={submitting} className="text-xs text-slate-400 hover:text-slate-600 underline">
            This isn&apos;t me — release claim
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      <h3 className="font-semibold text-slate-800 text-sm">{isOwner ? "Remove your profile" : "Remove this profile"}</h3>
      <p className="text-sm text-slate-600">
        {isOwner
          ? "This hides your career profile and team history from HuckHub Careers and keeps it out of future data refreshes."
          : "If your HuckHub profile name matches this one, it's removed right away. Otherwise we'll review your request."}
      </p>
      {!isOwner && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Anything we should know? (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white"
            rows={2}
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={submitting}
          className="text-sm bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {submitting ? "Submitting…" : isOwner ? "Remove my profile" : "Request removal"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-600 px-3 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
