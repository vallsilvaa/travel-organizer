export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Travel Organizer
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Everything for your next trip, organized in one place.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Plan itineraries, coordinate tasks, collaborate, and track expenses
          with your travel organizer.
        </p>
        <div className="mt-10 rounded-2xl bg-sky-50 p-5 text-sm leading-6 text-sky-950">
          The project foundation is ready. Product features will be delivered
          incrementally from the MVP backlog.
        </div>
      </section>
    </main>
  );
}
