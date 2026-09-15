import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

type SharedTrip = {
  trip_id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  timezone: string;
};

type SharedItineraryItem = {
  id: string;
  item_date: string;
  start_time: string | null;
  title: string;
  location: string | null;
  city: string | null;
};

export default async function SharedTripPage({ params }: SharePageProps) {
  const { token } = await params;
  const t = await getTranslations("shareLinkPage");
  const format = await getFormatter();
  const formatDate = (value: string) => format.dateTime(new Date(`${value}T00:00:00Z`), "medium");
  const formatTime = (value: string) => value.slice(0, 5);

  const supabase = await createClient();
  const [{ data: tripRows }, { data: itineraryRows }] = await Promise.all([
    supabase.rpc("get_trip_by_share_token", { p_token: token }),
    supabase.rpc("get_trip_itinerary_by_share_token", { p_token: token }),
  ]);

  const trip = ((tripRows ?? []) as SharedTrip[])[0];
  if (!trip) {
    notFound();
  }

  const items = (itineraryRows ?? []) as SharedItineraryItem[];
  const groups = new Map<string, SharedItineraryItem[]>();
  for (const item of items) {
    const list = groups.get(item.item_date) ?? [];
    list.push(item);
    groups.set(item.item_date, list);
  }
  const sortedDates = [...groups.keys()].sort();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{trip.destination}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {formatDate(trip.start_date)}
            {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ""}
          </p>
          <p className="mt-4 text-xs text-slate-500">{t("readOnlyNotice")}</p>
        </div>

        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
          <h2 className="text-2xl font-semibold text-slate-950">{t("itineraryTitle")}</h2>
          {sortedDates.length ? (
            <div className="mt-6 space-y-8">
              {sortedDates.map((date) => (
                <section key={date}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {formatDate(date)}
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {(groups.get(date) ?? []).map((item) => (
                      <li key={item.id} className="rounded-2xl border border-slate-200 p-4">
                        {item.start_time ? (
                          <p className="text-sm font-semibold text-sky-700">{formatTime(item.start_time)}</p>
                        ) : null}
                        <h4 className="mt-1 text-base font-semibold text-slate-950">{item.title}</h4>
                        {item.location || item.city ? (
                          <p className="mt-1 text-sm text-slate-600">
                            {[item.location, item.city].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">{t("itineraryEmpty")}</p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">{t("footer")}</p>
      </div>
    </main>
  );
}
