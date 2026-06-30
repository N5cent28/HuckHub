import { NextResponse } from "next/server";
import { getDistinctDivisions } from "@/lib/careers/loader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ divisions: getDistinctDivisions() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load divisions" }, { status: 500 });
  }
}
