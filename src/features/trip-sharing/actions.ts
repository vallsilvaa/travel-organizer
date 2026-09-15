"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidTripId } from "@/features/trips/validation";
import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  return { supabase, user };
}

// 24 random bytes, base64url-encoded (32 chars, URL-safe): the token IS the
// access control for the public share page, so it needs to be unguessable
// rather than merely unique.
function generateShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function createShareLink(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  if (!isValidTripId(tripId)) {
    redirect("/dashboard?tripError=invalid_trip");
  }

  const { supabase, user } = await authenticatedClient();

  // At most one active link per trip - otherwise the UI (which only shows
  // the latest one) would leave an older, still-valid link silently
  // reachable with no way to manage or revoke it.
  await supabase
    .from("trip_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .is("revoked_at", null);

  await supabase.from("trip_share_links").insert({
    trip_id: tripId,
    token: generateShareToken(),
    created_by: user.id,
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function revokeShareLink(formData: FormData): Promise<void> {
  const tripId = String(formData.get("tripId") ?? "");
  const linkId = String(formData.get("linkId") ?? "");
  if (!isValidTripId(tripId) || !uuidPattern.test(linkId)) {
    redirect("/dashboard?tripError=invalid_trip");
  }

  const { supabase } = await authenticatedClient();

  await supabase
    .from("trip_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("trip_id", tripId);

  revalidatePath(`/trips/${tripId}`);
}
