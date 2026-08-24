import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { buildReminderEmail, getReminderWindow } from "@/features/reminders/email";

type ReminderTask = {
  id: string;
  title: string;
  due_date: string;
  owner_id: string;
  trip_id: string;
  trips: { destination: string } | { destination: string }[];
};

function tripDestination(task: ReminderTask) {
  const destination = Array.isArray(task.trips)
    ? task.trips[0]?.destination
    : task.trips.destination;
  return destination ?? "Sua viagem";
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
    Sentry.captureMessage("Task reminder cron is not configured", {
      level: "error",
      tags: { route: "cron/task-reminders" },
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
  const window = getReminderWindow();
  const { data, error } = await supabase
    .from("trip_tasks")
    .select("id, title, due_date, owner_id, trip_id, trips!inner(destination)")
    .is("completed_at", null)
    .not("owner_id", "is", null)
    .gte("due_date", window.start)
    .lte("due_date", window.end);

  if (error) {
    console.error("Task reminder selection failed", { code: error.code });
    Sentry.captureException(new Error(`Task reminder selection failed: ${error.code}`), {
      tags: { route: "cron/task-reminders" },
    });
    return NextResponse.json({ error: "Could not select reminders" }, { status: 500 });
  }

  const tasks = (data ?? []) as unknown as ReminderTask[];
  const ownerIds = [...new Set(tasks.map((task) => task.owner_id))];
  const { data: enabledProfiles } = ownerIds.length
    ? await supabase
        .from("profiles")
        .select("id")
        .in("id", ownerIds)
        .eq("task_reminders_enabled", true)
    : { data: [] };
  const enabledOwners = new Set((enabledProfiles ?? []).map((profile) => profile.id));
  let sent = 0;
  let failed = 0;
  let skipped = tasks.length - tasks.filter((task) => enabledOwners.has(task.owner_id)).length;

  for (const task of tasks) {
    if (!enabledOwners.has(task.owner_id)) {
      continue;
    }

    const { data: claimed, error: claimError } = await supabase
      .from("task_reminder_deliveries")
      .upsert(
        {
          task_id: task.id,
          owner_id: task.owner_id,
          due_date: task.due_date,
          status: "pending",
        },
        { onConflict: "task_id,due_date", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      skipped += 1;
      continue;
    }

    // In-app notification, gated by the same task_reminders_enabled
    // preference and task_reminder_deliveries dedup as the email channel
    // above, so a task's deadline is only ever announced once per day.
    await supabase.from("notifications").insert({
      user_id: task.owner_id,
      trip_id: task.trip_id,
      notification_type: "deadline",
      title: "Prazo se aproximando",
      body: task.title,
      link_path: `/trips/${task.trip_id}?tab=preparation`,
    });

    const { data: ownerData, error: ownerError } =
      await supabase.auth.admin.getUserById(task.owner_id);
    const email = ownerData.user?.email;

    if (ownerError || !email) {
      failed += 1;
      await supabase
        .from("task_reminder_deliveries")
        .update({
          status: "failed",
          failure_code: ownerError ? "owner_lookup_failed" : "missing_email",
          attempted_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      const code = ownerError ? "owner_lookup_failed" : "missing_email";
      console.error("Task reminder delivery failed", { deliveryId: claimed.id, code });
      Sentry.captureMessage("Task reminder delivery failed", {
        level: "warning",
        tags: { route: "cron/task-reminders", code },
        extra: { deliveryId: claimed.id },
      });
      continue;
    }

    const destination = tripDestination(task);
    const message = buildReminderEmail({
      appUrl,
      deadline: task.due_date,
      taskTitle: task.title,
      tripDestination: destination,
      tripId: task.trip_id,
    });

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const responseBody = response.ok
        ? (await response.json()) as { id?: string }
        : null;

      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }

      sent += 1;
      await supabase
        .from("task_reminder_deliveries")
        .update({
          status: "sent",
          provider_message_id: responseBody?.id ?? null,
          attempted_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
    } catch (deliveryError) {
      failed += 1;
      const code = deliveryError instanceof Error && /^http_\d+$/.test(deliveryError.message)
        ? deliveryError.message
        : "network_error";
      await supabase
        .from("task_reminder_deliveries")
        .update({
          status: "failed",
          failure_code: code,
          attempted_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
      console.error("Task reminder delivery failed", {
        deliveryId: claimed.id,
        code,
      });
      Sentry.captureException(
        deliveryError instanceof Error ? deliveryError : new Error(code),
        {
          tags: { route: "cron/task-reminders", code },
          extra: { deliveryId: claimed.id },
        },
      );
    }
  }

  return NextResponse.json({ selected: tasks.length, sent, failed, skipped });
}
