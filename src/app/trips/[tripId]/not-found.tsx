import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function TripNotFound() {
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-card p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          {t("common.appName")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {t("tripNotFound.title")}
        </h1>
        {/* Deliberately vague: whether the trip never existed, was deleted,
            or the current account simply isn't a participant should all
            read the same from the outside - distinguishing them would leak
            which trips exist to someone who isn't authorized to see them. */}
        <p className="mt-4 text-base leading-7 text-slate-600">
          {t("tripNotFound.description")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/dashboard"
          >
            {t("notFound.goToDashboard")}
          </Link>
        </div>
      </section>
    </main>
  );
}
