import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Get the authorization header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { data: userData } = await sb.auth.getUser(token);
    const user = userData?.user || null;
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { targetId } = await req.json();
    
    if (!targetId) {
      return NextResponse.json({ error: "Target ID is required" }, { status: 400 });
    }
    
    // Get the target user's profile with contact preferences
    const { data: targetProfile, error: profileError } = await sb
      .from("profiles")
      .select("full_name, email, contact_preferences")
      .eq("id", targetId)
      .single();
    
    if (profileError || !targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Check if the target user has blocked the requesting user
    const { data: blockCheck } = await sb
      .from("user_blocks")
      .select("id")
      .eq("blocked_user_id", user.id)
      .eq("blocker_user_id", targetId)
      .maybeSingle();
    
    if (blockCheck) {
      return NextResponse.json({ error: "Cannot access contact info" }, { status: 403 });
    }
    
    // Get the requesting user's profile for their contact info
    const { data: requesterProfile } = await sb
      .from("profiles")
      .select("full_name, email, contact_preferences")
      .eq("id", user.id)
      .single();
    
    // Prepare contact info in the format expected by the frontend
    const contactInfo = {
      requester: {
        name: requesterProfile?.full_name || "Unknown",
        email: requesterProfile?.contact_preferences?.share_email ? requesterProfile?.email : null,
      },
      target: {
        name: targetProfile.full_name,
        email: targetProfile.contact_preferences?.share_email ? targetProfile.email : null,
      }
    };
    
    return NextResponse.json(contactInfo);
    
  } catch (error) {
    console.error("Error in contact/share:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
