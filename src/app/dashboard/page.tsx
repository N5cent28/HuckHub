"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { User, Settings, LogOut, AlertTriangle } from "lucide-react";
import { startNotificationListener, stopNotificationListener } from "@/lib/notifications-realtime";

const ADMIN_USER_ID = "b9ad6050-f56c-42a9-bb6f-5ce24347c9a7";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seekingUntil, setSeekingUntil] = useState<string | null>(null);
  const [notificationChannel, setNotificationChannel] = useState<any>(null);
  const [locationDeniedDialogResolver, setLocationDeniedDialogResolver] = useState<((choice: "cancel" | "add_parks" | "use_current_parks") => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUser(user);
          
          // Fetch user profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          setProfile(profileData);
          
          // Check if name is empty and redirect to profile setup
          if (!profileData?.full_name || profileData.full_name.trim() === "") {
            router.push("/profile/setup");
            return;
          }
          
          // Start listening for notifications
          startNotificationListener().then(channel => {
            setNotificationChannel(channel);
          });
          
          // check for an existing active seeking session
          const { data: sessions } = await supabase
            .from("seeking_sessions")
            .select("expires_at")
            .eq("user_id", user.id)
            .gt("expires_at", new Date().toISOString())
            .limit(1)
            .maybeSingle();
          if (sessions?.expires_at) setSeekingUntil(sessions.expires_at);
        } else {
          router.push("/auth/login");
        }
      } catch (error) {
        console.error("Error getting user:", error);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Cleanup on unmount
    return () => {
      if (notificationChannel) {
        stopNotificationListener(notificationChannel);
      }
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const startSeekingInline = async () => {
    if (!user) return;
    let preferredParksForSession: any[] = Array.isArray(profile?.preferred_parks) ? profile.preferred_parks : [];
    
    try {
      // Get user's current location (cached for 30 minutes to avoid repeated permission prompts)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // 1km accuracy is fine for park matching
          timeout: 5000, // 5 second timeout
          maximumAge: 1800000 // 30 minutes - use cached location if available to avoid repeated permission prompts
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Update user's last location in their profile
      const { error: locationError } = await supabase
        .from("profiles")
        .update({
          last_location: `(${longitude}, ${latitude})`,
          last_location_updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (locationError) {
        console.error("Error updating location:", locationError);
        console.error("Location error details:", JSON.stringify(locationError, null, 2));
        // Continue with seeking even if location update fails
      } else {
        console.log("Location updated:", { latitude, longitude });
      }

      // If the user has a radius preference, refresh preferred parks from current location.
      if (profile?.radius_miles) {
        try {
          const response = await fetch(`/api/parks/within?lat=${latitude}&lon=${longitude}&radius=${profile.radius_miles}`);
          const data = await response.json();

          if (response.ok && Array.isArray(data.parks)) {
            const refreshedPreferredParks = data.parks.map((park: any) => ({
              id: park.id,
              name: park.name,
              description: park.address || null,
              coordinates: [park.longitude, park.latitude],
              is_custom: false
            }));

            const { error: preferredParksError } = await supabase
              .from("profiles")
              .update({ preferred_parks: refreshedPreferredParks })
              .eq("id", user.id);

            if (preferredParksError) {
              console.error("Error updating preferred parks from radius:", preferredParksError);
            } else {
              preferredParksForSession = refreshedPreferredParks;
              setProfile((prev: any) => ({ ...(prev || {}), preferred_parks: refreshedPreferredParks }));
            }
          }
        } catch (parksRefreshError) {
          console.error("Error refreshing preferred parks from radius:", parksRefreshError);
        }
      }
    } catch (locationError) {
      console.error("Error getting location:", locationError);
      
      // Show a helpful message if location is denied
      if (locationError.code === 1) { // PERMISSION_DENIED
        const deniedAction = await new Promise<"cancel" | "add_parks" | "use_current_parks">((resolve) => {
          setLocationDeniedDialogResolver(() => resolve);
        });

        if (deniedAction === "add_parks") {
          router.push("/parks/search");
          return;
        }
        if (deniedAction === "cancel") return;

        preferredParksForSession = Array.isArray(profile?.preferred_parks) ? profile.preferred_parks : [];
      }
      // Continue with seeking even if location capture fails
    }

    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // ensure only one active session per user
    await supabase.from("seeking_sessions").delete().eq("user_id", user.id);
    const { error } = await supabase.from("seeking_sessions").insert({
      user_id: user.id,
      time_window_start: now.toISOString(),
      time_window_end: end.toISOString(),
      preferred_parks: preferredParksForSession,
      skill_preference: {},
      expires_at: end.toISOString(),
    });
    if (error) { console.error(error.message); return; }
    setSeekingUntil(end.toISOString());
  };

  const stopSeekingInline = async () => {
    if (!user) return;
    await supabase.from("seeking_sessions").delete().eq("user_id", user.id);
    setSeekingUntil(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/icon-192x192.png"
              alt="HuckHub Logo"
              width={60}
              height={60}
              className="rounded-full"
            />
          </div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Image
                src="/icon-192x192.png"
                alt="HuckHub Logo"
                width={40}
                height={40}
                className="rounded-full mr-3"
              />
              <h1 className="text-xl font-bold text-white">HuckHub</h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Admin Button - Only show for admin user */}
              {user?.id === ADMIN_USER_ID && (
                <button
                  onClick={() => router.push("/admin/custom-locations")}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  aria-label="Admin Panel"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={() => router.push("/profile/setup")}
                className="p-2 text-gray-400 hover:text-gray-300"
                aria-label="Edit profile"
              >
                <User className="h-5 w-5" />
              </button>
                    <button 
                      onClick={() => router.push("/settings")}
                      className="p-2 text-gray-400 hover:text-gray-300"
                      aria-label="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
              <button 
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-300"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Incomplete profile banner */}
        <IncompleteProfileBanner />

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-300">
            Ready to find your next throwing partner?
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Throw now
            </h3>
            <p className="text-gray-300 mb-4">
              Start a 2-hour active status so others know you're available.
            </p>
            {!seekingUntil ? (
              <button onClick={startSeekingInline} className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Throw now
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-gray-300 text-sm">Active until {new Date(seekingUntil).toLocaleTimeString()}</div>
                <button onClick={stopSeekingInline} className="w-full border-2 border-gray-600 text-gray-300 hover:bg-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors">
                  Cancel active status
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Find Matches
            </h3>
            <p className="text-gray-300 mb-4">
              Browse players who are currently looking for throwing partners.
            </p>
            <button onClick={()=>router.push("/matches")} className="w-full border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Browse Matches
            </button>
          </div>
        </div>

        {/* Additional Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Manage Parks
            </h3>
            <p className="text-gray-300 mb-4">
              Search and add parks to your preferred throwing locations.
            </p>
            <button onClick={()=>router.push("/parks/search")} className="w-full border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Search Parks
            </button>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              My Throwing Locations
            </h3>
            <div>
              {profile?.preferred_parks && profile.preferred_parks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.preferred_parks
                    .filter((park: any) => park && park.name) // Filter out null/undefined parks
                    .map((park: any, index: number) => {
                      const textSize = profile.preferred_parks.length > 8 ? "text-xs" : profile.preferred_parks.length > 4 ? "text-sm" : "text-base";
                      return (
                        <span
                          key={park.id || index}
                          className={`px-3 py-1 bg-gray-700 text-gray-300 rounded-full ${textSize} truncate max-w-[140px]`}
                          title={park.name}
                        >
                          {park.name}
                        </span>
                      );
                    })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No preferred parks yet</p>
              )}
            </div>
          </div>
        </div>

      </main>

      {locationDeniedDialogResolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-gray-600 bg-gray-800 p-6 shadow-xl">
            <p className="text-gray-100 leading-relaxed">
              Location access was denied. You can still seek throwing partners, but you won't get automatic park suggestions. Would you like to manually search and add parks or use your existing preferred list?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => {
                  locationDeniedDialogResolver("cancel");
                  setLocationDeniedDialogResolver(null);
                }}
                className="rounded-lg border border-gray-500 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  locationDeniedDialogResolver("use_current_parks");
                  setLocationDeniedDialogResolver(null);
                }}
                className="rounded-lg border border-green-500 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500 hover:text-white"
              >
                Use current parks
              </button>
              <button
                onClick={() => {
                  locationDeniedDialogResolver("add_parks");
                  setLocationDeniedDialogResolver(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add parks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncompleteProfileBanner() {
  const [show, setShow] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("skill_level, league_level")
        .eq("id", user.id)
        .maybeSingle();
      if (!data || !data.skill_level || !data.league_level) setNeedsProfile(true);
    };
    check();
  }, []);

  if (!show || !needsProfile) return null;
  return (
    <div className="mb-6 rounded-lg border border-yellow-400 bg-yellow-900/20 text-yellow-200 p-4 flex items-start justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-semibold">Complete your profile</p>
          <p className="text-sm">Add your throwing level and preferences to get better matches.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/profile/setup")} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-1.5 px-3 rounded-md">Complete now</button>
        <button onClick={() => setShow(false)} className="text-yellow-300 hover:text-yellow-200 text-sm">Dismiss</button>
      </div>
    </div>
  );
}
