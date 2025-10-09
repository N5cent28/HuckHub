import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  
  // Get the authorization header
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  
  if (!token) {
    return NextResponse.json({ profile: null, profileUserId: null });
  }
  
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user || null;
  
  if (!user) {
    return NextResponse.json({ profile: null, profileUserId: null });
  }
  
  const { data } = await sb.from("profiles").select("id,skill_level,radius_miles,general_availability,preferred_parks,contact_preferences,notification_preferences").eq("id", user.id).maybeSingle();
  return NextResponse.json({ profile: data || null, profileUserId: user.id });
}


