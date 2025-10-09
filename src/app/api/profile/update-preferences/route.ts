import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { notification_preferences, contact_preferences } = await req.json();
    
    console.log('Received preferences:', { notification_preferences, contact_preferences });
    
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Expect Authorization: Bearer <access_token>
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const { data: userData } = await sb.auth.getUser(token);
    const user = userData?.user || null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate that at least one notification method is enabled
    if (notification_preferences && !notification_preferences.email_notifications && !notification_preferences.push_notifications) {
      return NextResponse.json({ error: "At least one notification method must be enabled" }, { status: 400 });
    }

    // Update the profile with new preferences
    const updateData: any = {};
    if (notification_preferences) {
      updateData.notification_preferences = notification_preferences;
    }
    if (contact_preferences) {
      updateData.contact_preferences = contact_preferences;
    }

    console.log('Updating profile with:', updateData);

    const { error } = await sbAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
