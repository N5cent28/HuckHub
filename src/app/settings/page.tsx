"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { requestNotificationPermission, isNotificationSupported, getNotificationPermission, testNotification } from "@/lib/notifications";

type NotificationPreferences = {
  email_notifications: boolean;
  push_notifications: boolean;
  share_email: boolean;
  share_phone: boolean;
};

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: false,
    share_email: true,
    share_phone: false,
  });
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Check notification support
        setNotificationSupported(isNotificationSupported());
        setNotificationPermission(getNotificationPermission());

        let accessToken: string | undefined;
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
          const session = (await sb.auth.getSession()).data.session;
          accessToken = session?.access_token;
        } catch {}

        const res = await fetch("/api/profile/me", { 
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} 
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.contact_preferences) {
            setPreferences({
              email_notifications: data.profile.notification_preferences?.email_notifications ?? true,
              push_notifications: data.profile.notification_preferences?.push_notifications ?? false,
              share_email: data.profile.contact_preferences?.share_email ?? true,
              share_phone: data.profile.contact_preferences?.share_phone ?? false,
            });
          }
        }
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handlePushNotificationToggle = async (enabled: boolean) => {
    if (enabled && notificationSupported) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationPermission('granted');
        setPreferences(prev => ({ ...prev, push_notifications: true }));
      } else {
        alert('Notification permission denied. Please enable notifications in your browser settings.');
        return;
      }
    } else {
      setPreferences(prev => ({ ...prev, push_notifications: enabled }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let accessToken: string | undefined;
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
        const session = (await sb.auth.getSession()).data.session;
        accessToken = session?.access_token;
      } catch {}

      const res = await fetch("/api/profile/update-preferences", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          notification_preferences: {
            email_notifications: preferences.email_notifications,
            push_notifications: preferences.push_notifications,
          },
          contact_preferences: {
            share_email: preferences.share_email,
            share_phone: preferences.share_phone,
          }
        })
      });

      if (res.ok) {
        alert("Preferences saved successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/icon-192x192.png"
            alt="HuckHub Logo"
            width={48}
            height={48}
            className="mx-auto mb-4 opacity-50"
          />
          <p className="text-gray-300">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-300"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-8">
          {/* Notification Preferences */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Notification Preferences</h2>
            <p className="text-gray-300 text-sm mb-6">
              Choose how you want to be notified when someone requests to throw with you.
            </p>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Email Notifications</div>
                  <div className="text-gray-400 text-sm">Get notified via email when someone wants to throw</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.email_notifications}
                  onChange={(e) => setPreferences(prev => ({ ...prev, email_notifications: e.target.checked }))}
                  className="w-5 h-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Push Notifications</div>
                  <div className="text-gray-400 text-sm">
                    {!notificationSupported 
                      ? "Not supported in this browser" 
                      : notificationPermission === 'granted' 
                        ? "Get instant notifications on your device" 
                        : "Click to enable browser notifications"
                    }
                  </div>
                  {notificationSupported && notificationPermission === 'granted' && (
                    <button
                      onClick={testNotification}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      Test notification
                    </button>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={preferences.push_notifications}
                  onChange={(e) => handlePushNotificationToggle(e.target.checked)}
                  disabled={!notificationSupported}
                  className="w-5 h-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 disabled:opacity-50"
                />
              </label>

              <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                <div className="text-yellow-300 text-sm">
                  <strong>Note:</strong> You must have at least one notification method enabled to receive throwing requests.
                </div>
              </div>
            </div>
          </div>

          {/* Contact Sharing Preferences */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Contact Sharing</h2>
            <p className="text-gray-300 text-sm mb-6">
              Control what contact information you share when someone requests to throw with you.
            </p>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Share Email Address</div>
                  <div className="text-gray-400 text-sm">Allow others to see your email when you share contact info</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.share_email}
                  onChange={(e) => setPreferences(prev => ({ ...prev, share_email: e.target.checked }))}
                  className="w-5 h-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Share Phone Number</div>
                  <div className="text-gray-400 text-sm">Allow others to see your phone when you share contact info (coming soon)</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.share_phone}
                  onChange={(e) => setPreferences(prev => ({ ...prev, share_phone: e.target.checked }))}
                  disabled
                  className="w-5 h-5 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 opacity-50"
                />
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-6 border-t border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving || (!preferences.email_notifications && !preferences.push_notifications)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
