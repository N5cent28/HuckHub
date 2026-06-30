import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { isAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase";
import { resolveMergedProfile } from "@/lib/careers/search";
import { embedCareerFields } from "@/lib/careers/embed";
import { buildEmbedSourceText, overrideFromForm } from "@/lib/careers/merge";
import type { CareerAdminEdit } from "@/lib/careers/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const merged = await resolveMergedProfile(uid);
  if (!merged) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const sb = createServerClient();
  const { data: existing } = await sb
    .from("career_admin_edits")
    .select("*")
    .eq("player_uid", uid)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      player_uid: uid,
      full_name: merged.full_name,
      career_field: merged.career_field,
      current_role: merged.current_role,
      education: merged.education,
      career_summary: merged.career_summary,
      linkedin_url: merged.linkedin_url,
      known_locations: merged.known_locations,
      has_admin_edit: Boolean(existing),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const merged = await resolveMergedProfile(uid);
  if (!merged) {
    return NextResponse.json({ error: "Profile not found in index" }, { status: 404 });
  }

  const body = await req.json();
  const sb = createServerClient();

  const { data: existing } = await sb
    .from("career_admin_edits")
    .select("*")
    .eq("player_uid", uid)
    .maybeSingle();

  const partial = overrideFromForm(user.id, existing as CareerAdminEdit | null, body);
  if (!partial.full_name) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const embedText = partial.embed_source_text || buildEmbedSourceText(partial);
  let embedding: number[] | null = existing?.embedding ?? null;
  try {
    embedding = Array.from(
      await embedCareerFields({
        career_field: partial.career_field,
        current_role: partial.current_role,
        education: partial.education,
        career_summary: partial.career_summary,
      })
    );
  } catch (err) {
    console.error("Admin embed failed:", err);
  }

  const row = {
    player_uid: uid,
    full_name: partial.full_name,
    career_field: partial.career_field,
    current_role: partial.current_role,
    education: partial.education,
    career_summary: partial.career_summary,
    linkedin_url: partial.linkedin_url,
    known_locations: partial.known_locations,
    embed_source_text: embedText,
    embedding,
    edited_by: user.id,
  };

  const { data, error } = existing
    ? await sb.from("career_admin_edits").update(row).eq("player_uid", uid).select().single()
    : await sb.from("career_admin_edits").insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data, message: "Admin correction saved." });
}
