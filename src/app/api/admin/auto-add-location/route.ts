import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Admin user configuration
const ADMIN_USER_ID = "b9ad6050-f56c-42a9-bb6f-5ce24347c9a7";

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Regular client for auth verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verifyAdminAccess(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    return { isAdmin: false, error: "No authentication token provided" };
  }

  try {
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;

    if (!user) {
      return { isAdmin: false, error: "Invalid authentication token" };
    }

    if (user.id !== ADMIN_USER_ID) {
      return { isAdmin: false, error: "Access denied. Admin privileges required." };
    }

    return { isAdmin: true, user };
  } catch (error) {
    return { isAdmin: false, error: "Authentication verification failed" };
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Access denied" }, { status: 403 });
    }

    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    // Get the approved custom location
    const { data: location, error: locationError } = await supabaseAdmin
      .from("custom_locations")
      .select("*")
      .eq("id", locationId)
      .eq("is_approved", true)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: "Approved location not found" }, { status: 404 });
    }

    // Parse coordinates
    const coordsMatch = location.coordinates.match(/\(([^,]+),\s*([^)]+)\)/);
    if (!coordsMatch) {
      return NextResponse.json({ error: "Invalid coordinates format" }, { status: 400 });
    }

    const locationLng = parseFloat(coordsMatch[1]);
    const locationLat = parseFloat(coordsMatch[2]);

    // Get all users with radius preferences and any stored location
    const { data: users, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("id, radius_miles, preferred_parks, last_location, last_location_updated_at")
      .not("radius_miles", "is", null)
      .not("last_location", "is", null);

    if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    let addedCount = 0;
    const updates = [];

    // For each user, check if they're within radius and add the location
    for (const user of users || []) {
      // Parse user's last location
      const userCoordsMatch = user.last_location.match(/\(([^,]+),\s*([^)]+)\)/);
      if (!userCoordsMatch) continue;
      
      const userLng = parseFloat(userCoordsMatch[1]);
      const userLat = parseFloat(userCoordsMatch[2]);
      
      // Calculate actual distance between user and custom location
      const distance = calculateDistance(userLat, userLng, locationLat, locationLng);

      if (distance <= (user.radius_miles || 5)) {
        const currentParks = user.preferred_parks || [];
        
        // Check if location is already in preferred parks
        const alreadyExists = currentParks.some((park: any) => 
          park.id === locationId || park.name === location.name
        );

        if (!alreadyExists) {
          const newPark = {
            id: locationId,
            name: location.name,
            coordinates: location.coordinates,
            type: 'custom',
            added_automatically: true,
            added_at: new Date().toISOString()
          };

          updates.push({
            userId: user.id,
            newParks: [...currentParks, newPark]
          });
          addedCount++;
        }
      }
    }

    // Update all users' preferred parks
    for (const update of updates) {
      await supabaseAdmin
        .from("profiles")
        .update({ preferred_parks: update.newParks })
        .eq("id", update.userId);
    }

    return NextResponse.json({ 
      success: true, 
      addedToUsers: addedCount,
      totalUsers: users?.length || 0
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
