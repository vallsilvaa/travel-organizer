"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function updateReminderPreference(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  await supabase
    .from("profiles")
    .update({
      task_reminders_enabled: formData.get("taskRemindersEnabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  revalidatePath("/dashboard");
}
