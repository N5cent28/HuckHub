"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

interface Park {
  id: string;
  name: string;
  address: string;
  coordinates: string;
  amenities: any;
}

export default function ParkSearch() {
  const router = useRouter();
  const [parks, setParks] = useState<Park[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userPreferredParks, setUserPreferredParks] = useState<string[]>([]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Get user's current preferred parks
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferred_parks")
          .eq("id", user.id)
          .single();
        
        if (profile?.preferred_parks) {
          const parkIds = profile.preferred_parks
            .filter((park: any) => park && park.id) // Filter out null/undefined parks
            .map((park: any) => park.id);
          setUserPreferredParks(parkIds);
        }
      } else {
        router.push("/auth/login");
      }
    };

    getUser();
  }, [router]);

  useEffect(() => {
    loadParks();
  }, []);

  const loadParks = async () => {
    try {
      const { data, error } = await supabase
        .from("parks")
        .select("*")
        .order("name");

      if (error) throw error;
      setParks(data || []);
    } catch (error) {
      console.error("Error loading parks:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleParkPreference = async (parkId: string) => {
    if (!user) return;

    try {
      // Get current preferred parks (full objects)
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_parks")
        .eq("id", user.id)
        .single();
      
      const currentPreferredParks = profile?.preferred_parks || [];
      
      // Check if park is already in preferred parks (by ID)
      const isCurrentlyPreferred = currentPreferredParks.some((park: any) => park.id === parkId);
      let newPreferredParks;

      if (isCurrentlyPreferred) {
        // Remove from preferred parks
        newPreferredParks = currentPreferredParks.filter((park: any) => park.id !== parkId);
      } else {
        // Find the park data and add to preferred parks
        const parkToAdd = parks.find(park => park.id === parkId);
        if (parkToAdd) {
          // Parse PostGIS POINT format: (longitude, latitude)
          let coordinates = null;
          if (parkToAdd.coordinates) {
            const coordsMatch = parkToAdd.coordinates.match(/\(([^,]+),\s*([^)]+)\)/);
            if (coordsMatch) {
              const longitude = parseFloat(coordsMatch[1]);
              const latitude = parseFloat(coordsMatch[2]);
              coordinates = [longitude, latitude];
            }
          }
          
          const parkObject = {
            id: parkToAdd.id,
            name: parkToAdd.name,
            description: parkToAdd.address || null,
            coordinates: coordinates,
            is_custom: false
          };
          newPreferredParks = [...currentPreferredParks, parkObject];
        } else {
          console.error("Park not found:", parkId);
          return;
        }
      }

      // Update in database
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_parks: newPreferredParks })
        .eq("id", user.id);

      if (error) throw error;

      // Update local state with park IDs for the UI
      const parkIds = newPreferredParks.map((park: any) => park.id);
      setUserPreferredParks(parkIds);
    } catch (error) {
      console.error("Error updating preferred parks:", error);
      alert("Failed to update park preferences");
    }
  };

  const filteredParks = parks.filter(park =>
    park.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (park.address && park.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Loading parks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-300"
            aria-label="Go back"
          >
            ←
          </button>
          <Image src="/icon-192x192.png" alt="HuckHub" width={40} height={40} className="mr-4" />
          <div>
            <h1 className="text-white text-3xl font-bold">Search Parks</h1>
            <p className="text-gray-300 text-sm">Add parks to your preferred list</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search parks by name or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Parks List */}
        <div className="space-y-4">
          {filteredParks.map((park) => {
            const isPreferred = userPreferredParks.includes(park.id);
            
            return (
              <div
                key={park.id}
                className={`bg-gray-800 border rounded-lg p-4 ${
                  isPreferred ? "border-green-600 bg-green-900/20" : "border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{park.name}</h3>
                    {park.address && (
                      <p className="text-gray-300 text-sm mt-1">{park.address}</p>
                    )}
                    {park.amenities && Object.keys(park.amenities).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(park.amenities).map(([key, value]) => 
                          value ? (
                            <span
                              key={key}
                              className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                            >
                              {key.replace(/_/g, ' ')}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleParkPreference(park.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isPreferred
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    }`}
                  >
                    {isPreferred ? "✓ Added" : "Add to List"}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredParks.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              {searchTerm ? "No parks found matching your search." : "No parks available."}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-blue-300 font-semibold mb-2">💡 Tips</h3>
          <div className="text-sm text-blue-200 space-y-1">
            <p>• Search by park name (e.g., "Vilas") or address</p>
            <p>• Click "Add to List" to include parks in your preferred locations</p>
            <p>• These parks will be used for matching with other players</p>
            <p>• You can always come back and modify your list later</p>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-200">
            Don&apos;t see the park you&apos;re looking for? Add it here for an admin to approve.
          </p>
          <a
            href="/profile/custom-location"
            className="inline-block mt-3 text-green-400 hover:text-green-300 text-sm font-medium"
          >
            Add a custom location
          </a>
        </div>
      </div>
    </div>
  );
}
