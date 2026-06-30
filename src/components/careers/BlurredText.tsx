"use client";

/** Blurred name with hover prompt to sign in. */
export function BlurredName({
  name,
  className = "",
}: {
  name?: string | null;
  className?: string;
}) {
  return (
    <span className={`relative inline-block group ${className}`}>
      <span
        className="careers-blur-name inline-block select-none text-slate-700 cursor-help"
        aria-hidden
      >
        {name?.trim() || "Unknown"}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-[220px] rounded-lg bg-slate-800 text-white text-xs px-3 py-2 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all shadow-lg"
      >
        Sign in to view names &amp; contact info
      </span>
      <span className="sr-only">Name blurred — sign in to view</span>
    </span>
  );
}

export function BlurredSummary({
  summary,
  namePrefix,
  className = "",
}: {
  summary: string;
  namePrefix: string | null;
  className?: string;
}) {
  if (!namePrefix) {
    return <span className={className}>{summary}</span>;
  }

  const rest = summary.slice(namePrefix.length);
  return (
    <span className={className}>
      <span className="careers-blur-light inline">{namePrefix}</span>
      {rest}
    </span>
  );
}
