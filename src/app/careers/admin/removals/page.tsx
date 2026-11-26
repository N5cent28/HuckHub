"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";

interface RemovalRequest {
  id: string;
  player_uid: string;
  profile_name: string | null;
  contact_email: string | null;
  requester_user_id: string | null;
  message: string | null;
  created_at: string;
}

interface Removal {
  player_uid: string;
  profile_name: string | null;
  reason: string;
  requested_by: string | null;
  requester_email: string | null;
  created_at: string;
}

interface ClaimEvent {
  id: number;
  user_id: string;
  user_email: string | null;
  player_uid: string;
  profile_name: string | null;
  action: "claimed" | "revoked" | "released";
  linkedin_name: string | null;
  active: boolean;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  owner_request: "Removed by matching member",
  admin_approved_request: "Approved request",
  admin: "Removed by admin",
};

function ProfileLink({ uid, name }: { uid: string; name: string | null }) {
  return (
    <Link href={`/careers/profile/${encodeURIComponent(uid)}`} className="font-semibold text-sky-700 hover:underline">
      {name ?? uid}
    </Link>
  );
}

const btn = "text-sm px-3 py-1.5 rounded-lg disabled:opacity-60";

export default function AdminModerationPage() {
  const router = useRouter();
  const { token, authenticated, isAdmin, loading } = useCareersAuth();
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [removals, setRemovals] = useState<Removal[]>([]);
  const [claims, setClaims] = useState<ClaimEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    careersFetch("/api/careers/admin/removals", { token })
      .then((d) => {
        setRequests(d.requests as RemovalRequest[]);
        setRemovals(d.removals as Removal[]);
        setClaims(d.claims as ClaimEvent[]);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (loading) return;
    if (!authenticated || !isAdmin) {
      router.push("/careers");
      return;
    }
    load();
  }, [loading, authenticated, isAdmin, router, load]);

  const act = async (payload: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await careersFetch("/api/careers/admin/removals", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      if (d.message) setNotice(String(d.message));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const undoAccount = (userId: string, email: string | null) =>
    act(
      { action: "undo_account", user_id: userId },
      `Undo everything by ${email ?? userId}? This restores profiles they removed, revokes their claim, deletes their votes, and rejects their pending requests.`
    );

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <h1 className="text-xl font-bold text-slate-900">Careers moderation</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">{notice}</p>}

        <section>
          <h2 className="font-semibold text-slate-800 mb-3">Pending removal requests</h2>
          {requests.length === 0 ? (
            <p className="text-slate-500 text-sm">None.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <ProfileLink uid={r.player_uid} name={r.profile_name} />
                    <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">From {r.contact_email ?? "unknown"}</p>
                  {r.message && <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => act({ action: "approve", id: r.id })} className={`${btn} bg-slate-800 text-white`}>
                      Remove profile
                    </button>
                    <button type="button" disabled={busy} onClick={() => act({ action: "reject", id: r.id })} className={`${btn} border border-slate-200`}>
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-1">Recent removals</h2>
          <p className="text-xs text-slate-500 mb-3">Last 60 days. Restoring brings the profile back right away.</p>
          {removals.length === 0 ? (
            <p className="text-slate-500 text-sm">None.</p>
          ) : (
            <ul className="space-y-2">
              {removals.map((r) => (
                <li key={r.player_uid} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">{r.profile_name ?? r.player_uid}</p>
                    <p className="text-xs text-slate-500">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      {r.requester_email ? ` · ${r.requester_email}` : ""} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => act({ action: "restore", player_uid: r.player_uid })} className={`${btn} border border-slate-200`}>
                      Restore
                    </button>
                    {r.requested_by && r.reason === "owner_request" && (
                      <button type="button" disabled={busy} onClick={() => undoAccount(r.requested_by!, r.requester_email)} className={`${btn} border border-red-200 text-red-700`}>
                        Undo this account
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-1">Recent claims</h2>
          <p className="text-xs text-slate-500 mb-3">Last 60 days. Revoking removes the member&apos;s edits and frees the profile.</p>
          {claims.length === 0 ? (
            <p className="text-slate-500 text-sm">None.</p>
          ) : (
            <ul className="space-y-2">
              {claims.map((c) => (
                <li key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <ProfileLink uid={c.player_uid} name={c.profile_name} />{" "}
                      <span className="text-slate-500">
                        {c.action}
                        {c.active ? " (active)" : ""}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.user_email ?? c.user_id}
                      {c.linkedin_name ? ` · LinkedIn: ${c.linkedin_name}` : ""} · {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.active && (
                      <button type="button" disabled={busy} onClick={() => act({ action: "revoke_claim", user_id: c.user_id }, "Revoke this claim? The member's edits to this profile are deleted.")} className={`${btn} border border-slate-200`}>
                        Revoke claim
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => undoAccount(c.user_id, c.user_email)} className={`${btn} border border-red-200 text-red-700`}>
                      Undo this account
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
