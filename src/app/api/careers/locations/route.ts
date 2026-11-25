import { NextResponse } from "next/server";
import { getFacets } from "@/lib/careers/directory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ locations: (await getFacets()).locations });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }
}
