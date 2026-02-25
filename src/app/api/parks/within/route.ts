import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Haversine distance in miles
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // mi
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius")) || 5;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return NextResponse.json({ error: "lat/lon required" }, { status: 400 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.from("parks").select("id,name,address,coordinates");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const within = (data || []).map((p: any) => {
    const match = /\(([-0-9.]+),([-0-9.]+)\)/.exec(p.coordinates as string);
    if (!match) return null;
    const parkLon = Number(match[1]);
    const parkLat = Number(match[2]);
    const dist = haversineMiles(lat, lon, parkLat, parkLon);
    return { id: p.id, name: p.name, address: p.address, latitude: parkLat, longitude: parkLon, distance_mi: dist };
  }).filter(Boolean).filter((p: any) => p!.distance_mi <= radius)
    .sort((a: any, b: any) => a.distance_mi - b.distance_mi);

  return NextResponse.json({ parks: within });
}


