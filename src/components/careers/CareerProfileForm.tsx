"use client";

export interface CareerProfileFormValues {
  full_name: string;
  career_field: string;
  current_role: string;
  education: string;
  career_summary: string;
  linkedin_url: string;
  known_locations: string;
}

interface Props {
  form: CareerProfileFormValues;
  onChange: (form: CareerProfileFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  message: string;
  submitLabel?: string;
  showContactFields?: boolean;
  openToCareerChats?: boolean;
  onOpenToCareerChatsChange?: (v: boolean) => void;
  email?: string;
  onEmailChange?: (v: string) => void;
}

export function CareerProfileForm({
  form,
  onChange,
  onSubmit,
  saving,
  message,
  submitLabel = "Save profile",
  showContactFields = false,
  openToCareerChats = false,
  onOpenToCareerChatsChange,
  email = "",
  onEmailChange,
}: Props) {
  const set = (key: keyof CareerProfileFormValues, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {[
        { key: "full_name" as const, label: "Full name", required: true },
        { key: "current_role" as const, label: "Current role", placeholder: "e.g. Software Engineer @ Acme" },
        { key: "career_field" as const, label: "Career field", placeholder: "e.g. software engineering" },
        { key: "education" as const, label: "Education", placeholder: "Degrees, institutions" },
      ].map(({ key, label, required, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
          <input
            required={required}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:outline-none"
          />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
        <textarea
          value={form.career_summary}
          onChange={(e) => set("career_summary", e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Locations (comma-separated)</label>
        <input
          value={form.known_locations}
          onChange={(e) => set("known_locations", e.target.value)}
          placeholder="Madison, Wisconsin"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
        <input
          type="url"
          value={form.linkedin_url}
          onChange={(e) => set("linkedin_url", e.target.value)}
          placeholder="https://linkedin.com/in/…"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg"
        />
      </div>

      {showContactFields && onEmailChange && onOpenToCareerChatsChange && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={openToCareerChats}
              onChange={(e) => onOpenToCareerChatsChange(e.target.checked)}
              className="rounded border-slate-300 text-sky-600"
            />
            Open to career chats
          </label>
        </>
      )}

      {message && (
        <p className={`text-sm ${message.toLowerCase().includes("saved") || message.toLowerCase().includes("thanks") ? "text-emerald-700" : "text-red-600"}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
