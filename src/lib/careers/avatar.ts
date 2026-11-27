/**
 * LinkedIn profile photos for claimed career profiles.
 *
 * "Sign in with LinkedIn" (OIDC) includes a `picture` URL on the linked
 * identity. Those URLs expire, so we copy the image into the public
 * `career-avatars` bucket and store our URL on career_profile_overrides.
 */
import type { User } from "@supabase/supabase-js";
import type { createServerClient } from "@/lib/supabase";

const BUCKET = "career-avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Sb = ReturnType<typeof createServerClient>;

export function linkedInPictureUrl(user: User): string | null {
  const identity = user.identities?.find((i) => i.provider === "linkedin_oidc");
  const d = (identity?.identity_data || {}) as Record<string, unknown>;
  const url = d.picture ?? d.avatar_url;
  return typeof url === "string" && /^https:\/\//.test(url) ? url : null;
}

/** Copy the member's LinkedIn photo into Storage. Returns the public URL, or null. */
export async function storeLinkedInAvatar(sb: Sb, user: User): Promise<string | null> {
  const source = linkedInPictureUrl(user);
  if (!source) return null;
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !TYPES[type]) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return null;

    await deleteAvatar(sb, user.id);
    const path = `${user.id}.${TYPES[type]}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
    if (error) {
      console.error("Avatar upload failed:", error.message);
      return null;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`; // bust caches when replaced
  } catch (err) {
    console.error("Avatar fetch failed:", err);
    return null;
  }
}

export async function deleteAvatar(sb: Sb, userId: string): Promise<void> {
  await sb.storage.from(BUCKET).remove(Object.values(TYPES).map((ext) => `${userId}.${ext}`));
}
