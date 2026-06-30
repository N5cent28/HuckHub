export function ConfidenceBadge({
  label,
}: {
  label: "high" | "medium" | "low" | "member" | "admin";
}) {
  const styles = {
    member: "bg-sky-100 text-sky-800 border-sky-200",
    admin: "bg-violet-50 text-violet-800 border-violet-200",
    high: "bg-emerald-50 text-emerald-800 border-emerald-200",
    medium: "bg-amber-50 text-amber-800 border-amber-200",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const text = {
    member: "Member profile",
    admin: "Admin verified",
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[label]}`}>
      {text[label]}
    </span>
  );
}
