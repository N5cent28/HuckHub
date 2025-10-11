"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface CustomLocation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  coordinates: string;
  is_approved: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

// Admin user configuration
const ADMIN_USER_ID = "b9ad6050-f56c-42a9-bb6f-5ce24347c9a7";
const ADMIN_EMAIL = "noahryannicol@gmail.com";

export default function AdminCustomLocations() {
  const router = useRouter();
  const [locations, setLocations] = useState<CustomLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editCoords, setEditCoords] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/auth/login");
        return;
      }

      setUser(user);
      
      // Check if user is admin
      if (user.id === ADMIN_USER_ID) {
        setIsAdmin(true);
        loadLocations();
      } else {
        alert("Access denied. This page is restricted to administrators only.");
        router.push("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      console.log("Loading custom locations...");
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/admin/custom-locations", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load locations");
      }

      console.log("Locations loaded:", data.locations);
      setLocations(data.locations || []);
    } catch (error) {
      console.error("Error loading locations:", error);
      alert(`Error loading locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const approveLocation = async (id: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      // First approve the location
      const response = await fetch("/api/admin/custom-locations", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ id, is_approved: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve location");
      }

      // The database trigger will automatically move the location to parks table and add to users
      setEditing(null);
      loadLocations();
      alert("Location approved! It has been moved to the parks table and automatically added to users within their radius.");
    } catch (error) {
      console.error("Error approving location:", error);
      alert(`Error approving location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const rejectLocation = async (id: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/admin/custom-locations", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject location");
      }

      loadLocations();
    } catch (error) {
      console.error("Error rejecting location:", error);
      alert(`Error rejecting location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startEdit = (location: CustomLocation) => {
    setEditing(location.id);
    setEditName(location.name);
    setEditDescription(location.description || "");
    setEditCoords(location.coordinates);
  };

  const saveEdit = async (id: string) => {
    try {
      // Parse coordinates in (longitude, latitude) format
      let formattedCoords = editCoords.trim();
      let longitude: number | null = null;
      let latitude: number | null = null;

      // Remove parentheses if present
      formattedCoords = formattedCoords.replace(/^\(/, '').replace(/\)$/, '');
      
      const parts = formattedCoords.split(',').map(p => p.trim());

      if (parts.length === 2) {
        const first = parseFloat(parts[0]);
        const second = parseFloat(parts[1]);
        
        // Determine if first number is longitude or latitude based on value ranges
        // Longitude: -180 to 180, Latitude: -90 to 90
        // Madison, WI coordinates: ~-89.4 longitude, ~43.1 latitude
        if (Math.abs(first) > 90) {
          // First number is longitude (outside latitude range)
          longitude = first;
          latitude = second;
        } else if (Math.abs(second) > 90) {
          // Second number is longitude (outside latitude range)
          longitude = second;
          latitude = first;
        } else {
          // Both could be valid, check if first is negative (likely longitude for Madison)
          if (first < 0) {
            longitude = first;
            latitude = second;
          } else {
            longitude = second;
            latitude = first;
          }
        }
      }

      if (longitude === null || isNaN(longitude) || latitude === null || isNaN(latitude)) {
        alert("Invalid coordinate format. Please use '(longitude, latitude)' format.");
        return;
      }

      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180) {
        alert("Invalid longitude. Must be between -180 and 180.");
        return;
      }
      if (latitude < -90 || latitude > 90) {
        alert("Invalid latitude. Must be between -90 and 90.");
        return;
      }

      const finalCoords = `(${longitude}, ${latitude})`;
      console.log("Saving coordinates as:", finalCoords);
      console.log("Longitude:", longitude, "Latitude:", latitude);

      console.log("Updating location with data:", {
        id,
        name: editName,
        description: editDescription || null,
        coordinates: finalCoords,
      });

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/admin/custom-locations", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          name: editName,
          description: editDescription || null,
          coordinates: finalCoords,
        }),
      });

      const data = await response.json();
      console.log("Update result:", { response: response.status, data });

      if (!response.ok) {
        console.error("API error details:", data);
        throw new Error(data.error || "Failed to update location");
      }
      
      setEditing(null);
      loadLocations();
      alert("Location updated successfully!");
    } catch (error) {
      console.error("Error saving location:", error);
      alert(`Error saving location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditDescription("");
    setEditCoords("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-300 mb-4">This page is restricted to administrators only.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-300"
            aria-label="Go back"
          >
            ←
          </button>
          <Image src="/icon-192x192.png" alt="HuckHub" width={40} height={40} className="mr-4" />
          <h1 className="text-white text-3xl font-bold">Custom Locations Admin</h1>
        </div>

        {/* Admin Navigation */}
        <div className="mb-8">
          <div className="flex space-x-4">
            <button
              onClick={() => router.push("/admin/custom-locations")}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
            >
              Custom Locations
            </button>
            <button
              onClick={() => router.push("/admin/user-management")}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              User Management
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {locations.map((location) => (
            <div
              key={location.id}
              className={`bg-gray-800 border rounded-lg p-6 ${
                location.is_approved ? "border-green-600" : "border-yellow-600"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{location.name}</h3>
                  <p className="text-gray-300 text-sm">
                    Submitted by: {location.profiles?.full_name} ({location.profiles?.email})
                  </p>
                  <p className="text-gray-400 text-xs">
                    {new Date(location.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      location.is_approved
                        ? "bg-green-900 text-green-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {location.is_approved ? "Approved" : "Pending"}
                  </span>
                </div>
              </div>

              {editing === location.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Coordinates
                    </label>
                    <input
                      type="text"
                      value={editCoords}
                      onChange={(e) => setEditCoords(e.target.value)}
                      placeholder="(-89.390567150623, 43.0663838272434)"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Format: (longitude, latitude)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(location.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {location.description && (
                    <p className="text-gray-300">{location.description}</p>
                  )}
                  <p className="text-gray-400 font-mono text-sm">
                    Coordinates: {location.coordinates}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => startEdit(location)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                    >
                      Edit
                    </button>
                    {!location.is_approved && (
                      <>
                        <button
                          onClick={() => approveLocation(location.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectLocation(location.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {locations.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No custom locations submitted yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
