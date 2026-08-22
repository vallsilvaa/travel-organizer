"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function authRedirect(path: string, kind: string, code: string) {
  redirect(`${path}?${kind}=${encodeURIComponent(code)}`);
}

export async function signUp(formData: FormData) {
  const displayName = formValue(formData, "displayName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const passwordConfirmation = formValue(formData, "passwordConfirmation");

  if (displayName.length < 2) {
    authRedirect("/auth/sign-up", "error", "invalid_name");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    authRedirect("/auth/sign-up", "error", "invalid_email");
  }
  if (password.length < 8) {
    authRedirect("/auth/sign-up", "error", "invalid_password");
  }
  if (password !== passwordConfirmation) {
    authRedirect("/auth/sign-up", "error", "password_mismatch");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    authRedirect(
      "/auth/sign-up",
      "error",
      error.status === 429 ? "rate_limited" : "signup_failed",
    );
  }

  if (data.session) {
    redirect("/dashboard");
  }

  authRedirect("/auth/sign-in", "message", "check_email");
}

export async function signIn(formData: FormData) {
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");

  if (!email || !password) {
    authRedirect("/auth/sign-in", "error", "invalid_credentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    authRedirect(
      "/auth/sign-in",
      "error",
      error.status === 429 ? "rate_limited" : "invalid_credentials",
    );
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formValue(formData, "email").toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    authRedirect("/auth/forgot-password", "error", "invalid_email");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  // Supabase does not reveal whether the email is registered, and neither
  // do we: the same "check your email" message shows whether or not the
  // account exists. Only a rate-limit response gets a distinct message,
  // since "you're sending too many requests" doesn't leak account existence.
  if (error?.status === 429) {
    authRedirect("/auth/forgot-password", "error", "rate_limited");
  }

  authRedirect("/auth/forgot-password", "message", "check_email_reset");
}

async function applyNewPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
): Promise<string | null> {
  const password = formValue(formData, "password");
  const passwordConfirmation = formValue(formData, "passwordConfirmation");

  if (password.length < 8) {
    return "invalid_password";
  }
  if (password !== passwordConfirmation) {
    return "password_mismatch";
  }

  const { error } = await supabase.auth.updateUser({ password });
  return error ? "password_update_failed" : null;
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    authRedirect("/auth/forgot-password", "error", "reset_link_invalid");
  }

  const errorCode = await applyNewPassword(supabase, formData);
  if (errorCode) {
    authRedirect("/auth/reset-password", "error", errorCode);
  }

  // End the one-time recovery session so the reset link truly can't be
  // reused after this point, and have the user sign in fresh with the new
  // password.
  await supabase.auth.signOut();
  authRedirect("/auth/sign-in", "message", "password_updated");
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const errorCode = await applyNewPassword(supabase, formData);
  if (errorCode) {
    authRedirect("/dashboard", "passwordError", errorCode);
  }

  authRedirect("/dashboard", "passwordMessage", "password_updated");
}

export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const displayName = formValue(formData, "displayName");
  if (displayName.length < 2 || displayName.length > 100) {
    authRedirect("/dashboard", "profileError", "invalid_display_name");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    authRedirect("/dashboard", "profileError", "profile_update_failed");
  }

  authRedirect("/dashboard", "profileMessage", "profile_updated");
}
