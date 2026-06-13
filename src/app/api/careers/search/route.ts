import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { searchCareers } from "@/lib/careers/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getAuthUser(req);

    const { results, total } = await searchCareers({
      query: body.query,
      location: body.location,
      min_confidence: body.min_confidence,
      linkedin_verified: body.linkedin_verified,
      top_k: body.top_k ?? 25,
      authenticated: Boolean(user),
    });

    return NextResponse.json({ results, total, authenticated: Boolean(user) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
