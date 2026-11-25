import { NextResponse } from "next/server";
import { getFacets } from "@/lib/careers/directory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ divisions: (await getFacets()).divisionLabels });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load divisions" }, { status: 500 });
  }
}
