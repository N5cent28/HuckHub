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

export default function AdminRemovalsPage() {
  const router = useRouter();
  const { token, authenticated, isAdmin, loading } = useCareersAuth();
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    careersFetch("/api/careers/admin/removals", { token })
      .then((d) => setRequests(d.requests as RemovalRequest[]))
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

  const resolve = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      await careersFetch("/api/careers/admin/removals", {
        method: "POST",
        token,
        body: JSON.stringify({ id, action }),
      });
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Removal requests</h1>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {requests.length === 0 ? (
          <p className="text-slate-500 text-sm">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <Link
                    href={`/careers/profile/${encodeURIComponent(r.player_uid)}`}
                    className="font-semibold text-sky-700 hover:underline"
                  >
                    {r.profile_name ?? r.player_uid}
                  </Link>
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-600">
                  From {r.contact_email ?? "unknown"}
                  {r.requester_user_id ? " (signed in)" : " (no account)"}
                </p>
                {r.message && <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.message}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => resolve(r.id, "approve")}
                    className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Remove profile
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => resolve(r.id, "reject")}
                    className="text-sm border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
