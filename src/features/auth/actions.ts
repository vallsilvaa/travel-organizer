"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function authRedirect(path: string, kind: "error" | "message", code: string) {
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
