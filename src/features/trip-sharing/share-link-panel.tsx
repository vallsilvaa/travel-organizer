"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

import { createShareLink, revokeShareLink } from "./actions";

type ShareLinkPanelProps = {
  tripId: string;
  activeLink: { id: string; url: string } | null;
};

export function ShareLinkPanel({ tripId, activeLink }: ShareLinkPanelProps) {
  const t = useTranslations("trip.organizer.shareLink");

  async function copyLink() {
    if (!activeLink) return;
    try {
      await navigator.clipboard.writeText(activeLink.url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-950">{t("title")}</h3>
      <p className="mt-1 text-sm text-slate-600">{t("description")}</p>

      {activeLink ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <code className="truncate text-sm text-slate-700">{activeLink.url}</code>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {t("copy")}
            </Button>
            <form action={revokeShareLink}>
              <input type="hidden" name="tripId" value={tripId} />
              <input type="hidden" name="linkId" value={activeLink.id} />
              <SubmitButton pendingLabel={t("revoking")} variant="outline" size="sm">
                {t("revoke")}
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <form action={createShareLink} className="mt-4">
          <input type="hidden" name="tripId" value={tripId} />
          <SubmitButton pendingLabel={t("generating")} variant="outline">
            {t("generate")}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
