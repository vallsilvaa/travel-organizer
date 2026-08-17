export default function TripLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12" aria-busy="true">
      <section className="mx-auto max-w-4xl animate-pulse space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="h-5 w-36 rounded bg-slate-200" />
        <div className="h-10 w-2/3 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-24 rounded-2xl bg-slate-100" />
        </div>
        <p className="text-sm text-slate-500">Loading trip and itinerary...</p>
      </section>
    </main>
  );
}
