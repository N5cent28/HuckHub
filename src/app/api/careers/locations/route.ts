import { NextResponse } from "next/server";
import { getDistinctLocations } from "@/lib/careers/loader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ locations: getDistinctLocations() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }
}
