// Service Worker for HuckHub Push Notifications
console.log('🔔 Service Worker loaded');

// Listen for push events
self.addEventListener('push', function(event) {
  console.log('🔔 Push event received:', event);
  
  if (event.data) {
    const data = event.data.json();
    console.log('🔔 Push data:', data);
    
    const options = {
      body: data.body || 'You have a new throwing request!',
      icon: '/icon-192x192.png',
      badge: '/icon-24x24.ico',
      tag: 'huckhub-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Request'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'HuckHub - New Request', options)
    );
  }
});

// Listen for notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('🔔 Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Listen for service worker installation
self.addEventListener('install', function(event) {
  console.log('🔔 Service Worker installed');
  self.skipWaiting();
});

// Listen for service worker activation
self.addEventListener('activate', function(event) {
  console.log('🔔 Service Worker activated');
  event.waitUntil(self.clients.claim());
});
