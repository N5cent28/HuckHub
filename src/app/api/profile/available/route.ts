import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function currentSlot(): "Morning"|"Afternoon"|"Evening" {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function currentDay(): string {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
}

export async function GET(req: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const slot = currentSlot();
  const day = currentDay();
  
  // Get current user to filter out blocked users
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  let currentUserId: string | null = null;
  
  if (token) {
    const { data: userData } = await sb.auth.getUser(token);
    currentUserId = userData?.user?.id || null;
  }
  
  const { data, error } = await sb
    .from("profiles")
    .select("id,full_name,pronouns,skill_level,league_level,general_availability,preferred_parks,radius_miles");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let filtered = (data || []).filter((p: any) => {
    const avail = p.general_availability || {};
    const slots = avail[day] || [];
    return Array.isArray(slots) && slots.includes(slot);
  });

  // Filter out blocked users if we have a current user
  if (currentUserId) {
    console.log('[DEBUG] Current user ID:', currentUserId);
    const { data: blockedUsers } = await sb
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", currentUserId);
    
    console.log('[DEBUG] Blocked users:', blockedUsers);
    const blockedIds = new Set(blockedUsers?.map(b => b.blocked_id) || []);
    console.log('[DEBUG] Blocked IDs:', Array.from(blockedIds));
    
    const beforeFilter = filtered.length;
    filtered = filtered.filter(p => !blockedIds.has(p.id));
    const afterFilter = filtered.length;
    
    console.log('[DEBUG] Filtered profiles before:', beforeFilter, 'after:', afterFilter);
  } else {
    console.log('[DEBUG] No current user ID, skipping block filter');
  }
  
  return NextResponse.json({ profiles: filtered, day, slot });
}


