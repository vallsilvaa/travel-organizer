import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-card p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Travel Organizer
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Tudo para sua próxima viagem, organizado em um só lugar.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Planeje itinerários, organize tarefas, colabore e acompanhe despesas
          com seu organizador de viagens.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/auth/sign-up"
          >
            Criar conta
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-card px-5 py-3 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/auth/sign-in"
          >
            Entrar
          </Link>
        </div>
        <div className="mt-10 rounded-2xl bg-sky-50 p-5 text-sm leading-6 text-sky-950">
          A base do projeto está pronta. As funcionalidades serão entregues de
          forma incremental a partir do backlog do MVP.
        </div>
      </section>
    </main>
  );
}
