import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.SEED_SECRET || "dev"}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csvPath = path.join(process.cwd(), "public", "Park_locations.csv");
  const csv = fs.readFileSync(csvPath, "utf8");
  const parsed = Papa.parse(csv, { header: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(supabaseUrl, serviceKey);

  const rows = (parsed.data as any[]).filter((r) => r["Park Name"]);
  const payload = rows.map((r) => ({
    name: r["Park Name"],
    address: `${r.Address}, ${r.City}, ${r.State} ${r["Postal Code"]}`,
    // store as Postgres point "(lon,lat)" if using point, or as object for later PostGIS
    coordinates: `(${Number(r.Longitude)},${Number(r.Latitude)})`,
  }));

  const { error } = await sb.from("parks").upsert(payload, { onConflict: "name" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ inserted: payload.length });
}


