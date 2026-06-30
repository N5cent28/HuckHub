export function ProfileConfidence({
  score,
  isUserEdited,
  isAdminEdited = false,
}: {
  score: number | null;
  isUserEdited: boolean;
  isAdminEdited?: boolean;
}) {
  if (isUserEdited) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-sky-100 text-sky-800 border-sky-200">
        Member profile
      </span>
    );
  }

  if (isAdminEdited) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-violet-50 text-violet-800 border-violet-200">
        Admin verified
      </span>
    );
  }

  if (score == null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
        Confidence unknown
      </span>
    );
  }

  const pct = Math.round(score * 100);
  const tone =
    pct >= 80
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : pct >= 50
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium tabular-nums ${tone}`}>
      {pct}% confidence
    </span>
  );
}
