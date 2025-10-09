import { createClient } from "@supabase/supabase-js";
import { showNotification } from "./notifications";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function startNotificationListener() {
  console.log('🔔 Starting real-time notification listener...');
  
  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ No user found for notification listener');
    return null;
  }
  
  console.log('🔔 Listening for notifications for user:', user.id);
  
  // Listen for new notifications for this specific user
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        console.log('🔔 New notification received for current user:', payload);
        
        const notification = payload.new;
        
        // Show browser notification
        console.log('🔔 Triggering browser notification popup...');
        showNotification(notification.title, {
          body: notification.body,
          data: notification.data,
          tag: `notification-${notification.id}`,
          requireInteraction: true
        });
        console.log('✅ Browser notification triggered!');
      }
    )
    .subscribe((status) => {
      console.log('🔔 Notification channel status:', status);
    });

  return channel;
}

export function stopNotificationListener(channel: any) {
  if (channel) {
    console.log('🔔 Stopping notification listener...');
    supabase.removeChannel(channel);
  }
}
