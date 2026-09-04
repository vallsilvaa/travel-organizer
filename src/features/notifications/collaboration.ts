import type { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getTripRoleAudience } from "@/lib/trip-roles";
import {
  buildCollaborationEmail,
  buildCollaborationNotificationCopy,
  type CollaborationAction,
  type CollaborationEntityType,
} from "./collaboration-email";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const notificationTypeByAction: Record<CollaborationAction, string> = {
  created: "item_created",
  updated: "item_updated",
  deleted: "item_deleted",
};

export type NotifyTripCollaboratorsInput = {
  supabase: SupabaseClient;
  tripId: string;
  actorId: string;
  entityType: CollaborationEntityType;
  entityId: string;
  action: CollaborationAction;
  itemLabel: string;
  tab: string;
};

// Fires an in-app notification (and, for opted-in recipients, an email) to
// the "opposite" role from whoever just made a change: an organizer's
// change notifies travelers (#144), a traveler's change notifies
// organizers (#142). Deliberately never throws - a notification-delivery
// failure must not roll back or surface as an error on the user's actual
// create/update/delete action, so every failure path here is caught and
// logged (error code only, never trip/item content) instead of propagated.
export async function notifyTripCollaborators(input: NotifyTripCollaboratorsInput): Promise<void> {
  const { supabase, tripId, entityType, entityId, action, actorId } = input;

  try {
    const { data: eventId } = await supabase.rpc("claim_collaboration_notification_event", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_action: action,
    });

    if (!eventId) {
      // Already handled - a retry of the same operation within the same
      // minute, or (theoretically) a race with another request.
      return;
    }

    const audience = await getTripRoleAudience(supabase, tripId);
    const actorIsOrganizer = audience.organizerIds.includes(actorId);
    const recipientIds = (actorIsOrganizer ? audience.travelerIds : audience.organizerIds).filter(
      (id) => id !== actorId,
    );

    if (recipientIds.length === 0) {
      return;
    }

    const [{ data: actorProfile }, { data: trip }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", actorId).maybeSingle(),
      supabase.from("trips").select("destination").eq("id", tripId).single(),
    ]);
    const actorName = (actorProfile as { display_name: string } | null)?.display_name ?? "Alguém";
    const tripDestination = (trip as { destination: string } | null)?.destination ?? "sua viagem";

    const copy = buildCollaborationNotificationCopy({
      actorName,
      entityType,
      action,
      itemLabel: input.itemLabel,
    });
    const linkPath = `/trips/${tripId}?tab=${input.tab}`;

    await supabase.rpc("create_collaboration_notifications", {
      p_trip_id: tripId,
      p_recipient_ids: recipientIds,
      p_notification_type: notificationTypeByAction[action],
      p_title: copy.title,
      p_body: copy.body,
      p_link_path: linkPath,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return;
    }

    const { data: recipientRows } = await supabase.rpc("get_trip_participant_emails", {
      requested_trip_id: tripId,
      requested_user_ids: recipientIds,
    });
    const emailRecipients = (
      (recipientRows ?? []) as { user_id: string; email: string | null; collaboration_emails_enabled: boolean }[]
    ).filter((row) => row.collaboration_emails_enabled && row.email);

    if (emailRecipients.length === 0) {
      return;
    }

    const message = buildCollaborationEmail({
      appUrl,
      actorName,
      entityType,
      action,
      itemLabel: input.itemLabel,
      tripDestination,
      tripId,
      tab: input.tab,
      occurredAt: new Date(),
    });

    for (const recipient of emailRecipients) {
      const result = await sendEmail({
        to: recipient.email as string,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (!result.success) {
        console.error("Collaboration notification email failed", {
          code: result.error,
          entityType,
          action,
        });
      }
    }
  } catch (error) {
    console.error("Collaboration notification failed", {
      code: error instanceof Error ? error.message : "unknown_error",
      entityType,
      action,
    });
  }
}
