"use server";

import { cookies } from "next/headers";

import { isLocale, localeCookieName } from "./locale";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
