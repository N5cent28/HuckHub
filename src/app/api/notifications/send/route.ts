import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { targetUserId, fromUserId, title, body, data = {} } = await req.json();
  
  if (!targetUserId || !fromUserId || !title || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    // Insert notification into database
    const { data: notification, error } = await sbAdmin
      .from("notifications")
      .insert({
        user_id: targetUserId,
        from_user_id: fromUserId,
        type: 'match_request',
        title,
        body,
        data
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create notification:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('✅ Notification created:', notification.id);
    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('❌ Notification API error:', error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
