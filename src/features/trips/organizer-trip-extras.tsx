"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CatalogTemplate = {
  id: string;
  title: string;
  category: string;
  country: string;
  city: string | null;
};

type OrganizerTripExtrasProps = {
  templates: CatalogTemplate[];
};

export function OrganizerTripExtras({ templates }: OrganizerTripExtrasProps) {
  const t = useTranslations("organizerPanel.createTrip.extras");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return templates;
    }
    return templates.filter((template) =>
      [template.title, template.category, template.country, template.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [templates, query]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <>
      <input type="hidden" name="organizerContext" value="true" />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="organizer-trip-task-search">{t("tasksLabel")}</Label>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasksEmpty")}</p>
        ) : (
          <>
            <Input
              id="organizer-trip-task-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("tasksSearchPlaceholder")}
            />
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
              {filtered.map((template) => (
                <li key={template.id}>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      name="taskTemplateIds"
                      value={template.id}
                      checked={selectedIds.includes(template.id)}
                      onChange={() => toggle(template.id)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span>{template.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="organizer-trip-invite-email">{t("inviteLabel")}</Label>
        <Input
          id="organizer-trip-invite-email"
          name="inviteEmail"
          type="email"
          placeholder={t("invitePlaceholder")}
        />
        <p className="text-sm text-muted-foreground">{t("inviteHint")}</p>
      </div>
    </>
  );
}
