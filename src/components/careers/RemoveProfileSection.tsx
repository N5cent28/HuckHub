"use client";

import { useState } from "react";
import { careersFetch } from "@/lib/careers/client";

/**
 * "Don't want to be listed?" — owners (claimed, or signed in with a matching
 * HuckHub name) are removed immediately; anyone else files a request that an
 * admin reviews. No account is required to ask.
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
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ removed: boolean; message: string } | null>(null);
  const [error, setError] = useState("");

  const submit = async () => {
    if (isOwner && !window.confirm("Remove your profile from HuckHub Careers? This can't be undone from the site.")) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const data = await careersFetch("/api/careers/remove", {
        method: "POST",
        token,
        body: JSON.stringify({
          player_uid: playerUid,
          message: message.trim() || undefined,
          contact_email: email.trim() || undefined,
        }),
      });
      setResult({ removed: Boolean(data.removed), message: String(data.message) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        {result.message}
        {result.removed && (
          <>
            {" "}
            <a href="/careers" className="text-sky-600 underline">Back to search</a>
          </>
        )}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 hover:text-slate-600 underline"
      >
        {isOwner ? "Remove my profile from HuckHub Careers" : "Is this you and you'd rather not be listed? Request removal"}
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
      <h3 className="font-semibold text-slate-800 text-sm">
        {isOwner ? "Remove your profile" : "Remove this profile"}
      </h3>
      <p className="text-sm text-slate-600">
        {isOwner
          ? "This hides your career profile and team history from HuckHub Careers and keeps it out of future data refreshes."
          : authenticated
            ? "If your HuckHub profile name matches this one, it's removed right away. Otherwise we'll review your request."
            : "We'll review your request and email you once the profile is removed. You don't need a HuckHub account."}
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
      {!authenticated && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Your email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
            placeholder="you@example.com"
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
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
