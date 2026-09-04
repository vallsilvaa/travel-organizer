import webpush from "web-push";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

function vapidConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

let vapidDetailsSet = false;
function ensureVapidDetails() {
  if (vapidDetailsSet) {
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  vapidDetailsSet = true;
}

// A subscription is the opt-in itself (#146) - a user with zero rows here
// just never receives a push, no separate preference to check. Failures
// are per-subscription and never thrown: one stale device on one browser
// must not block push (or any other channel) to the person's other
// devices, let alone the calling notification flow.
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured()) {
    return;
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions?.length) {
    return;
  }

  ensureVapidDetails();

  await Promise.all(
    (subscriptions as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(
      async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(payload),
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            return;
          }
          console.error("Push delivery failed", { code: statusCode ?? "unknown" });
        }
      },
    ),
  );
}
