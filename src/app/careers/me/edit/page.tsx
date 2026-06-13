"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { careersFetch, useCareersAuth } from "@/lib/careers/client";

export default function EditCareerProfilePage() {
  const router = useRouter();
  const { token, authenticated, loading: authLoading } = useCareersAuth();
  const [form, setForm] = useState({
    full_name: "",
    career_field: "",
    current_role: "",
    education: "",
    career_summary: "",
    linkedin_url: "",
    known_locations: "",
    email: "",
    open_to_career_chats: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!authenticated) {
      router.push("/auth/login?next=/careers/me/edit");
      return;
    }
    careersFetch("/api/careers/me", { token })
      .then((d) => {
        if (d.profile) {
          setForm({
            full_name: d.profile.full_name || "",
            career_field: d.profile.career_field || "",
            current_role: d.profile.current_role || "",
            education: d.profile.education || "",
            career_summary: d.profile.career_summary || "",
            linkedin_url: d.profile.linkedin_url || "",
            known_locations: (d.profile.known_locations || []).join(", "),
            email: d.profile.email || "",
            open_to_career_chats: d.profile.open_to_career_chats || false,
          });
        }
      })
      .catch(console.error);
  }, [authLoading, authenticated, token, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await careersFetch("/api/careers/me", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...form,
          known_locations: form.known_locations.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setMessage("Profile saved. Your details now appear in search.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <CareersHeader authenticated={false} />
        <div className="max-w-xl mx-auto px-4 py-16 text-slate-500">Loading…</div>
      </>
    );
  }

  return (
    <>
      <CareersHeader authenticated={authenticated} />
      <main className="max-w-xl mx-auto px-4 py-8">
        <Link href="/careers" className="text-sm text-sky-600 hover:underline mb-4 inline-block">
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Your career profile</h1>
        <p className="text-slate-600 text-sm mb-6">
          Your edits override inferred data and power search. Keep it accurate — others may use this to connect.
        </p>

        <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          {[
            { key: "full_name", label: "Full name", required: true },
            { key: "current_role", label: "Current role", placeholder: "e.g. Software Engineer @ Acme" },
            { key: "career_field", label: "Career field", placeholder: "e.g. software engineering" },
            { key: "education", label: "Education", placeholder: "Degrees, institutions" },
          ].map(({ key, label, required, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                required={required}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
            <textarea
              value={form.career_summary}
              onChange={(e) => setForm({ ...form, career_summary: e.target.value })}
              rows={4}
              placeholder="A short professional summary"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Locations (comma-separated)</label>
            <input
              value={form.known_locations}
              onChange={(e) => setForm({ ...form, known_locations: e.target.value })}
              placeholder="Madison, Wisconsin"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional, shown when signed in)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.open_to_career_chats}
              onChange={(e) => setForm({ ...form, open_to_career_chats: e.target.checked })}
              className="rounded border-slate-300 text-sky-600"
            />
            Open to career chats
          </label>

          {message && (
            <p className={`text-sm ${message.includes("saved") ? "text-emerald-700" : "text-red-600"}`}>{message}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t see yourself in our index?{" "}
          <Link href="/careers/claim" className="text-sky-600 hover:underline">
            Claim or create a profile
          </Link>
        </p>
      </main>
    </>
  );
}
