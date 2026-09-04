import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { buildOverdueTasksEmail, type OverdueTaskEmailItem } from "@/features/reminders/overdue-email";
import { getTripRoleAudience } from "@/lib/trip-roles";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { todayInTimeZone } from "@/lib/timezone";

type OverdueTrip = { id: string; destination: string; timezone: string };

type OverdueTask = {
  id: string;
  title: string;
  due_date: string;
  owner_id: string | null;
  trip_id: string;
  trips: OverdueTrip | OverdueTrip[];
};

function taskTrip(task: OverdueTask): OverdueTrip {
  const trip = Array.isArray(task.trips) ? task.trips[0] : task.trips;
  return trip ?? { id: task.trip_id, destination: "Sua viagem", timezone: "UTC" };
}

function daysOverdue(dueDate: string, today: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / msPerDay);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.REMINDER_EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom || !appUrl) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
      !resendApiKey && "RESEND_API_KEY",
      !emailFrom && "REMINDER_EMAIL_FROM",
      !appUrl && "NEXT_PUBLIC_APP_URL",
    ].filter(Boolean);
    Sentry.captureMessage("Overdue task cron is not configured", {
      level: "error",
      tags: { route: "cron/overdue-tasks" },
      extra: { missing },
    });
    return NextResponse.json(
      { error: "Reminder service is not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("trip_tasks")
    .select("id, title, due_date, owner_id, trip_id, trips!inner(id, destination, timezone)")
    .is("completed_at", null)
    .not("due_date", "is", null);

  if (error) {
    console.error("Overdue task selection failed", { code: error.code });
    Sentry.captureException(new Error(`Overdue task selection failed: ${error.code}`), {
      tags: { route: "cron/overdue-tasks" },
    });
    return NextResponse.json({ error: "Could not select overdue tasks" }, { status: 500 });
  }

  const allTasks = (data ?? []) as unknown as OverdueTask[];
  const overdueTasks = allTasks.filter(
    (task) => task.due_date < todayInTimeZone(taskTrip(task).timezone),
  );

  // Group by (trip, recipient) so a trip with several overdue tasks for the
  // same person becomes one digest email, not one per task.
  const groups = new Map<string, { trip: OverdueTrip; recipientId: string; tasks: OverdueTask[] }>();
  const organizerIdsByTrip = new Map<string, string[]>();

  for (const task of overdueTasks) {
    const trip = taskTrip(task);
    if (!organizerIdsByTrip.has(trip.id)) {
      const audience = await getTripRoleAudience(
        supabase as unknown as Parameters<typeof getTripRoleAudience>[0],
        trip.id,
      );
      organizerIdsByTrip.set(trip.id, audience.organizerIds);
    }

    const recipients = new Set(organizerIdsByTrip.get(trip.id));
    if (task.owner_id) {
      recipients.add(task.owner_id);
    }

    for (const recipientId of recipients) {
      const key = `${trip.id}:${recipientId}`;
      const group = groups.get(key);
      if (group) {
        group.tasks.push(task);
      } else {
        groups.set(key, { trip, recipientId, tasks: [task] });
      }
    }
  }

  const recipientIds = [...new Set([...groups.values()].map((group) => group.recipientId))];
  const { data: enabledProfiles } = recipientIds.length
    ? await supabase
        .from("profiles")
        .select("id")
        .in("id", recipientIds)
        .eq("task_reminders_enabled", true)
    : { data: [] };
  const enabledRecipients = new Set((enabledProfiles ?? []).map((profile) => profile.id));

  const ownerIds = [...new Set(overdueTasks.map((task) => task.owner_id).filter((id): id is string => Boolean(id)))];
  const { data: ownerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds)
    : { data: [] };
  const ownerNames = new Map((ownerProfiles ?? []).map((profile) => [profile.id, profile.display_name]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const group of groups.values()) {
    // Push is its own channel (a subscription is the opt-in, #146), sent
    // once per (trip, recipient) group per run regardless of the
    // email-specific task_reminders_enabled preference below.
    await sendPushToUser(supabase, group.recipientId, {
      title: "Tarefas atrasadas",
      body: `${group.tasks.length} tarefa${group.tasks.length === 1 ? "" : "s"} atrasada${group.tasks.length === 1 ? "" : "s"} em ${group.trip.destination}`,
      url: `/trips/${group.trip.id}?tab=preparation`,
    });

    if (!enabledRecipients.has(group.recipientId)) {
      skipped += group.tasks.length;
      continue;
    }

    const today = todayInTimeZone(group.trip.timezone);
    const claimedTaskIds: string[] = [];
    const claimedDeliveryIds: string[] = [];

    for (const task of group.tasks) {
      const { data: claimed, error: claimError } = await supabase
        .from("overdue_task_reminder_deliveries")
        .upsert(
          { task_id: task.id, recipient_id: group.recipientId, alert_date: today, status: "pending" },
          { onConflict: "task_id,recipient_id,alert_date", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();

      if (claimError || !claimed) {
        skipped += 1;
        continue;
      }

      claimedTaskIds.push(task.id);
      claimedDeliveryIds.push(claimed.id);
    }

    if (!claimedTaskIds.length) {
      continue;
    }

    const { data: recipientData, error: recipientError } =
      await supabase.auth.admin.getUserById(group.recipientId);
    const email = recipientData.user?.email;

    if (recipientError || !email) {
      failed += claimedDeliveryIds.length;
      const code = recipientError ? "recipient_lookup_failed" : "missing_email";
      await supabase
        .from("overdue_task_reminder_deliveries")
        .update({ status: "failed", failure_code: code, attempted_at: new Date().toISOString() })
        .in("id", claimedDeliveryIds);
      console.error("Overdue task alert failed", { deliveryIds: claimedDeliveryIds, code });
      Sentry.captureMessage("Overdue task alert failed", {
        level: "warning",
        tags: { route: "cron/overdue-tasks", code },
        extra: { deliveryIds: claimedDeliveryIds },
      });
      continue;
    }

    const items: OverdueTaskEmailItem[] = group.tasks
      .filter((task) => claimedTaskIds.includes(task.id))
      .map((task) => ({
        title: task.title,
        ownerName: task.owner_id ? (ownerNames.get(task.owner_id) ?? "Sem responsável") : "Sem responsável",
        dueDate: task.due_date,
        daysOverdue: daysOverdue(task.due_date, today),
      }));

    const message = buildOverdueTasksEmail({
      appUrl,
      tripDestination: group.trip.destination,
      tripId: group.trip.id,
      tasks: items,
    });

    const result = await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (result.success) {
      sent += claimedDeliveryIds.length;
      await supabase
        .from("overdue_task_reminder_deliveries")
        .update({ status: "sent", provider_message_id: result.messageId, attempted_at: new Date().toISOString() })
        .in("id", claimedDeliveryIds);
      await supabase.from("notifications").insert({
        user_id: group.recipientId,
        trip_id: group.trip.id,
        notification_type: "task_overdue",
        title: "Tarefas atrasadas",
        body: group.trip.destination,
        link_path: `/trips/${group.trip.id}?tab=preparation`,
      });
    } else {
      failed += claimedDeliveryIds.length;
      await supabase
        .from("overdue_task_reminder_deliveries")
        .update({ status: "failed", failure_code: result.error, attempted_at: new Date().toISOString() })
        .in("id", claimedDeliveryIds);
      console.error("Overdue task alert delivery failed", {
        deliveryIds: claimedDeliveryIds,
        code: result.error,
      });
      Sentry.captureException(new Error(result.error), {
        tags: { route: "cron/overdue-tasks", code: result.error },
        extra: { deliveryIds: claimedDeliveryIds },
      });
    }
  }

  return NextResponse.json({ overdue: overdueTasks.length, groups: groups.size, sent, failed, skipped });
}
