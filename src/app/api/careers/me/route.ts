import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { embedCareerFields } from "@/lib/careers/embed";
import { overrideFromForm, buildEmbedSourceText } from "@/lib/careers/merge";
import type { CareerProfileOverride } from "@/lib/careers/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();
  const { data, error } = await sb
    .from("career_profile_overrides")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sb = createServerClient();

  const { data: existing } = await sb
    .from("career_profile_overrides")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const partial = overrideFromForm(user.id, existing as CareerProfileOverride | null, body);
  if (!partial.full_name) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  let embedding: number[] | null = existing?.embedding ?? null;
  const embedText = partial.embed_source_text || buildEmbedSourceText(partial);
  if (embedText) {
    try {
      const vec = await embedCareerFields({
        career_field: partial.career_field,
        current_role: partial.current_role,
        education: partial.education,
        career_summary: partial.career_summary,
      });
      embedding = Array.from(vec);
    } catch (err) {
      console.error("Embed on save failed:", err);
    }
  }

  const row = {
    ...partial,
    embed_source_text: embedText,
    embedding,
    user_id: user.id,
    player_uid: existing?.player_uid ?? body.player_uid ?? null,
    claimed_at: existing?.claimed_at ?? null,
  };

  const { data, error } = existing
    ? await sb.from("career_profile_overrides").update(row).eq("user_id", user.id).select().single()
    : await sb.from("career_profile_overrides").insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
