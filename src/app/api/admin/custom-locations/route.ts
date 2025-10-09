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

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Access denied" }, { status: 403 });
    }

    // First get custom locations
    const { data: locationsData, error: fetchError } = await supabaseAdmin
      .from("custom_locations")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching custom locations:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Then get user profiles for each location and format coordinates
    const locationsWithProfiles = await Promise.all(
      (locationsData || []).map(async (location) => {
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", location.user_id)
          .single();

        return {
          ...location,
          coordinates: location.coordinates || `(${location.longitude}, ${location.latitude})`,
          profiles: profileData || { full_name: "Unknown User", email: "Unknown" }
        };
      })
    );

    return NextResponse.json({ locations: locationsWithProfiles });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Access denied" }, { status: 403 });
    }

    const { id, name, description, coordinates, is_approved } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_approved !== undefined) updateData.is_approved = is_approved;

    // Handle coordinates - use the same format as parks table
    if (coordinates !== undefined) {
      // Extract longitude and latitude from (longitude, latitude) string
      const coordsMatch = coordinates.match(/\(([^,]+),\s*([^)]+)\)/);
      if (!coordsMatch) {
        return NextResponse.json({ error: "Invalid coordinates format. Use (longitude, latitude)" }, { status: 400 });
      }
      
      const longitude = parseFloat(coordsMatch[1]);
      const latitude = parseFloat(coordsMatch[2]);
      
      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180) {
        return NextResponse.json({ error: "Invalid longitude. Must be between -180 and 180." }, { status: 400 });
      }
      if (latitude < -90 || latitude > 90) {
        return NextResponse.json({ error: "Invalid latitude. Must be between -90 and 90." }, { status: 400 });
      }
      
      // Use the same format as parks: (longitude, latitude) 
      updateData.coordinates = `(${longitude}, ${latitude})`;
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("custom_locations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating custom location:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ location: data });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Access denied" }, { status: 403 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("custom_locations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting custom location:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
