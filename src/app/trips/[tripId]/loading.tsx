import { Skeleton } from "@/components/ui/skeleton";

export default function TripLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12" aria-busy="true">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10 sm:p-10">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-8 h-10 w-2/3" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-2 h-4 w-80" />
            <div className="mt-6 space-y-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
