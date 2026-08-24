import { NextResponse } from "next/server";

type CheckResult = { status: "ok" | "error"; detail?: string };

async function checkSupabase(): Promise<CheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return { status: "error", detail: "missing_config" };
  }

  try {
    // Supabase Auth's own health endpoint: reachable regardless of table
    // grants or RLS policies, so it can't false-positive on permission
    // errors the way querying a real table would.
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? { status: "ok" } : { status: "error", detail: `http_${response.status}` };
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
