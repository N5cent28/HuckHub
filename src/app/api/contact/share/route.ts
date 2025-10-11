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
    
    // Prepare contact info based on user's preferences
    const contactInfo: any = {
      name: targetProfile.full_name,
    };
    
    // Add email if user has enabled sharing
    if (targetProfile.contact_preferences?.share_email) {
      contactInfo.email = targetProfile.email;
    }
    
    // Add phone if user has enabled sharing (when implemented)
    if (targetProfile.contact_preferences?.share_phone) {
      // TODO: Add phone number when implemented
      contactInfo.phone = "Phone sharing not yet implemented";
    }
    
    return NextResponse.json(contactInfo);
    
  } catch (error) {
    console.error("Error in contact/share:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
