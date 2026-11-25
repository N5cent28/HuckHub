import { NextResponse } from "next/server";
import { getCareersMeta } from "@/lib/careers/directory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getCareersMeta());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load careers metadata" }, { status: 500 });
  }
}
