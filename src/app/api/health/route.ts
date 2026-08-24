import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CheckResult = { status: "ok" | "error"; detail?: string };

async function checkSupabase(): Promise<CheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { status: "error", detail: "missing_config" };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return error ? { status: "error", detail: error.code } : { status: "ok" };
  } catch {
    return { status: "error", detail: "unreachable" };
  }
}

function checkReminders(): CheckResult {
  const configured =
    process.env.CRON_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.RESEND_API_KEY &&
    process.env.REMINDER_EMAIL_FROM &&
    process.env.NEXT_PUBLIC_APP_URL;
  return configured ? { status: "ok" } : { status: "error", detail: "missing_config" };
}

export async function GET() {
  const checks = {
    supabase: await checkSupabase(),
    reminders: checkReminders(),
  };

  const healthy = Object.values(checks).every((check) => check.status === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
