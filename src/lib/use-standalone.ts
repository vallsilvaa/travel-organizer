"use client";

import { useSyncExternalStore } from "react";

const query = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// jsdom (vitest.config.mts has no setupFiles) doesn't implement matchMedia,
// so this stays false under test - components fall back to their regular
// (non-standalone) rendering with no mocking required.
function getSnapshot() {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

export function useStandalone() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
