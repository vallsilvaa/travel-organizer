import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12" aria-busy="true">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-9 w-48" />
        </div>

        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-xl bg-card p-8 ring-1 ring-foreground/10">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        ))}
      </div>
    </main>
  );
}
