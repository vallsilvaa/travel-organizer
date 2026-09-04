"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deletePushSubscription, savePushSubscription } from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "enabled" | "disabled";

export function PushToggle() {
  const t = useTranslations("pushNotifications");
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (
        !publicKey ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setStatus("unsupported");
        }
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancelled) {
        setStatus(subscription ? "enabled" : "disabled");
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) {
      return;
    }

    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("permissionDenied"));
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: json.endpoint as string,
        keys: { p256dh: json.keys?.p256dh as string, auth: json.keys?.auth as string },
      });

      if (!result.success) {
        await subscription.unsubscribe();
        toast.error(t("errorToast"));
        return;
      }

      setStatus("enabled");
      toast.success(t("enabledToast"));
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setStatus("disabled");
      toast.success(t("disabledToast"));
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setPending(false);
    }
  }

  if (status === "checking" || status === "unsupported") {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{t("label")}</p>
        <p className="text-sm text-muted-foreground">{t(status === "enabled" ? "enabledHint" : "disabledHint")}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={status === "enabled" ? disable : enable}
      >
        {pending ? t("pending") : t(status === "enabled" ? "disable" : "enable")}
      </Button>
    </div>
  );
}
