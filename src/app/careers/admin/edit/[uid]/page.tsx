"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { CareerProfileForm, type CareerProfileFormValues } from "@/components/careers/CareerProfileForm";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";

function AdminEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const uid = decodeURIComponent(params.uid as string);
  const fromQuery = searchParams.get("from");
  const backHref = fromQuery ? `/careers?${fromQuery}` : "/careers";
  const profileHref = `/careers/profile/${encodeURIComponent(uid)}${fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : ""}`;

  const { token, authenticated, isAdmin, loading: authLoading } = useCareersAuth();
  const [form, setForm] = useState<CareerProfileFormValues>({
    full_name: "",
    career_field: "",
    current_role: "",
    education: "",
    career_summary: "",
    linkedin_url: "",
    known_locations: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!authenticated || !isAdmin) {
      router.push("/careers");
      return;
    }
    careersFetch(`/api/careers/admin/profile/${encodeURIComponent(uid)}`, { token })
      .then((d) => {
        const p = d.profile;
        setForm({
          full_name: p.full_name || "",
          career_field: p.career_field || "",
          current_role: p.current_role || "",
          education: p.education || "",
          career_summary: p.career_summary || "",
          linkedin_url: p.linkedin_url || "",
          known_locations: (p.known_locations || []).join(", "),
        });
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : "Failed to load"));
  }, [authLoading, authenticated, isAdmin, token, uid, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await careersFetch(`/api/careers/admin/profile/${encodeURIComponent(uid)}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...form,
          known_locations: form.known_locations.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setMessage(data.message as string);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="max-w-xl mx-auto px-4 py-16 text-slate-500">Loading…</div>;
  }

  if (!isAdmin) return null;

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-xl mx-auto px-4 py-8">
        <Link href={profileHref} className="text-sm text-sky-600 hover:underline mb-4 inline-block">
          ← Back to profile
        </Link>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
            Admin edit
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Correct career profile</h1>
        <p className="text-slate-600 text-sm mb-6">
          Your changes override inferred data for everyone searching HuckHub Careers. Member-claimed
          profiles still take precedence over admin edits.
        </p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <CareerProfileForm
            form={form}
            onChange={setForm}
            onSubmit={handleSave}
            saving={saving}
            message={message}
            submitLabel="Save admin correction"
          />
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href={backHref} className="text-sky-600 hover:underline">
            Return to search
          </Link>
        </p>
      </main>
    </>
  );
}

export default function AdminEditCareerProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading…</div>}>
      <AdminEditContent />
    </Suspense>
  );
}
