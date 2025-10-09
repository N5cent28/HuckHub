// Push notification utilities
// This provides the foundation for push notifications

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    // Register service worker for push notifications
    await registerServiceWorker();
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('Notification permission denied');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    // Register service worker for push notifications
    await registerServiceWorker();
  }
  return permission === 'granted';
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('🔔 Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  } else {
    console.log('❌ Service Worker not supported');
  }
}

export function showNotification(title: string, options?: NotificationOptions) {
  console.log('🔔 Attempting to show notification:', title);
  console.log('🔔 Notification permission:', Notification.permission);
  console.log('🔔 Document visibility:', document.visibilityState);
  console.log('🔔 Document focused:', document.hasFocus());
  
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-24x24.ico',
        requireInteraction: true, // Keep notification until user interacts
        silent: false, // Make sure it makes sound
        ...options
      });
      
      console.log('✅ Notification created successfully:', notification);
      
      // Add event listeners for debugging
      notification.onshow = () => {
        console.log('🔔 Notification shown!');
      };
      
      notification.onclick = () => {
        console.log('🔔 Notification clicked!');
        window.focus();
        notification.close();
      };
      
      notification.onclose = () => {
        console.log('🔔 Notification closed');
      };
      
      notification.onerror = (error) => {
        console.error('❌ Notification error:', error);
      };
      
      // Don't auto-close - let user interact with it
      return notification;
    } catch (error) {
      console.error('❌ Failed to create notification:', error);
    }
  } else {
    console.log('❌ Notification permission not granted:', Notification.permission);
  }
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) return null;
  return Notification.permission;
}

export function testNotification() {
  console.log('🧪 Testing notification...');
  console.log('🧪 Browser support:', isNotificationSupported());
  console.log('🧪 Current permission:', getNotificationPermission());
  console.log('🧪 User agent:', navigator.userAgent);
  console.log('🧪 Platform:', navigator.platform);
  
  if (isNotificationSupported() && getNotificationPermission() === 'granted') {
    // Try multiple notification types
    console.log('🧪 Sending test notification...');
    
    const notification = showNotification('HuckHub Test', {
      body: 'This is a test notification from HuckHub! If you can see this, notifications are working!',
      tag: 'test-notification',
      requireInteraction: true,
      silent: false
    });
    
    if (notification) {
      console.log('✅ Test notification sent');
      
      // Also try a simple alert as fallback
      setTimeout(() => {
        console.log('🧪 If you don\'t see a notification, check your browser settings');
        alert('If you don\'t see a browser notification, check your browser\'s notification settings for localhost:3000');
      }, 2000);
    } else {
      console.log('❌ Failed to create test notification');
    }
  } else {
    console.log('❌ Cannot show test notification - permission not granted or not supported');
    alert('Notifications not supported or permission not granted. Check browser settings.');
  }
}
