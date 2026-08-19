import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>

        <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>

        <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <Skeleton className="h-6 w-32" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
