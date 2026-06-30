export interface CareersSearchState {
  query: string;
  location: string;
  division: string;
  minConfidence: number;
  linkedinOnly: boolean;
  page: number;
}

export function parseCareersSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams
): CareersSearchState {
  const pageRaw = parseInt(params.get("page") ?? "1", 10);
  const confRaw = parseFloat(params.get("conf") ?? "0");

  return {
    query: params.get("q") ?? "",
    location: params.get("location") ?? "",
    division: params.get("division") ?? "",
    minConfidence: Number.isFinite(confRaw) ? confRaw : 0,
    linkedinOnly: params.get("linkedin") === "1",
    page: Number.isFinite(pageRaw) ? Math.max(0, pageRaw - 1) : 0,
  };
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, "get">;

export function buildCareersSearchQuery(state: CareersSearchState): string {
  const params = new URLSearchParams();
  const q = state.query.trim();
  const loc = state.location.trim();
  const division = state.division.trim();

  if (q) params.set("q", q);
  if (loc) params.set("location", loc);
  if (division) params.set("division", division);
  if (state.minConfidence > 0) params.set("conf", String(state.minConfidence));
  if (state.linkedinOnly) params.set("linkedin", "1");
  if (state.page > 0) params.set("page", String(state.page + 1));

  return params.toString();
}

export function careersSearchHref(state: CareersSearchState): string {
  const qs = buildCareersSearchQuery(state);
  return qs ? `/careers?${qs}` : "/careers";
}
