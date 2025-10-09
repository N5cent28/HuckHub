import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { targetId, message, seekingSessionId, notificationType = 'email' } = await req.json();
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
  if (!['email', 'push'].includes(notificationType)) return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
  
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Expect Authorization: Bearer <access_token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user || null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get requester profile
  const { data: requesterProfile } = await sbAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // Get target profile
  const { data: targetProfile } = await sbAdmin
    .from("profiles")
    .select("full_name, email, notification_preferences")
    .eq("id", targetId)
    .single();

  if (!requesterProfile || !targetProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Insert match request
  const { error } = await sbAdmin.from("match_requests").insert({
    requester_id: user.id,
    target_id: targetId,
    seeking_session_id: seekingSessionId ?? null,
    message: message || null,
    status: 'pending',
  });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Check notification preferences
  const emailEnabled = targetProfile.notification_preferences?.email_notifications !== false;
  const pushEnabled = targetProfile.notification_preferences?.push_notifications === true;
  
  console.log('📧 Notification check:');
  console.log('📧 Target user:', targetProfile.full_name, '(', targetProfile.email, ')');
  console.log('📧 Email enabled:', emailEnabled);
  console.log('📧 Push enabled:', pushEnabled);
  console.log('📧 Requested type:', notificationType);
  console.log('📧 Notification preferences:', targetProfile.notification_preferences);

  // Check if the requested notification type is enabled
  if (notificationType === 'email' && !emailEnabled) {
    return NextResponse.json({ 
      success: false, 
      message: `${targetProfile.full_name || 'This user'} has email notifications disabled. Try using the Push notification option instead.` 
    });
  }
  
  if (notificationType === 'push' && !pushEnabled) {
    return NextResponse.json({ 
      success: false, 
      message: `${targetProfile.full_name || 'This user'} has push notifications disabled. Try using the Email option instead.` 
    });
  }

  // If both are disabled
  if (!emailEnabled && !pushEnabled) {
    return NextResponse.json({ 
      success: false, 
      message: `${targetProfile.full_name || 'This user'} has all notifications disabled. You may need to contact them through other means to arrange throwing.` 
    });
  }

  // Send the requested notification
  if (notificationType === 'email' && emailEnabled) {
    try {
      console.log('📧 Attempting to send email notification...');
      const { sendMatchRequestEmail } = await import('@/lib/email');
      
      const emailResult = await sendMatchRequestEmail({
        to: targetProfile.email,
        fromName: requesterProfile.full_name || 'Someone',
        fromEmail: requesterProfile.email,
        message: message || undefined,
        targetName: targetProfile.full_name || 'User'
      });
      
      if (emailResult.success) {
        console.log('✅ Email notification sent successfully');
        if (emailResult.messageId) {
          console.log('📧 Message ID:', emailResult.messageId);
        }
      } else {
        console.error('❌ Email notification failed:', emailResult.error);
        return NextResponse.json({ success: false, message: 'Failed to send email notification' });
      }
    } catch (emailError) {
      console.error('❌ Email notification error:', emailError);
      return NextResponse.json({ success: false, message: 'Failed to send email notification' });
    }
  } else if (notificationType === 'push' && pushEnabled) {
    console.log('🔔 Sending push notification to:', targetProfile.full_name);
    console.log('🔔 Message:', message || 'No message');
    
    try {
      // Send notification to database (will trigger real-time updates)
      const notificationRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: targetId,
          fromUserId: user.id,
          title: `New throwing request from ${requesterProfile.full_name || 'Someone'}`,
          body: message || 'Someone wants to throw with you!',
          data: {
            type: 'match_request',
            seekingSessionId: seekingSessionId || null,
            requesterName: requesterProfile.full_name || 'Someone'
          }
        })
      });

      if (notificationRes.ok) {
        console.log('✅ Push notification sent successfully');
      } else {
        console.error('❌ Failed to send push notification');
      }
    } catch (error) {
      console.error('❌ Push notification error:', error);
    }
  }

  return NextResponse.json({ success: true });
}


