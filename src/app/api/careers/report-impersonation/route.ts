import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { sendImpersonationReportEmail } from "@/lib/careers/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { reported_player_uid, reported_override_id, message, evidence_notes } = body;

  if (!reported_player_uid && !reported_override_id) {
    return NextResponse.json({ error: "Report target is required" }, { status: 400 });
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: "Please describe why this profile belongs to you" }, { status: 400 });
  }

  const sb = createServerClient();
  const { data, error } = await sb
    .from("career_impersonation_reports")
    .insert({
      reporter_user_id: user.id,
      reported_player_uid: reported_player_uid ?? null,
      reported_override_id: reported_override_id ?? null,
      message: message.trim(),
      evidence_notes: evidence_notes?.trim() || null,
      dispute_reason: "claim_conflict",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sendImpersonationReportEmail({
      reporterUserId: user.id,
      reporterEmail: user.email ?? "unknown",
      reportedPlayerUid: reported_player_uid,
      message: message.trim(),
      evidenceNotes: evidence_notes?.trim(),
    });
  } catch (err) {
    console.error("Impersonation email failed:", err);
  }

  return NextResponse.json({ report: data, message: "Report submitted. We'll review it shortly." });
}
