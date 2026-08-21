"use client";

import { useEffect } from "react";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Only mounts if the root layout itself throws (very rare - normal page
// errors are caught by error.tsx, which keeps the layout, nav, and styles
// around it intact). Since this replaces the root layout, it has to render
// its own <html>/<body> and re-import the global stylesheet.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 antialiased">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Travel Organizer
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Algo deu errado
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Não foi possível carregar o aplicativo. Tente novamente em
            instantes.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            >
              Tentar novamente
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}
