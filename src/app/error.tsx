"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-card p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Travel Organizer
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Algo deu errado
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Não foi possível carregar esta página. Você pode tentar de novo ou
          voltar para um lugar seguro.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" size="lg" onClick={() => reset()}>
            Tentar novamente
          </Button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-card px-5 py-3 font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/dashboard"
          >
            Ir para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}
