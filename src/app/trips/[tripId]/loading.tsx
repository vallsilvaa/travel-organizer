import { Skeleton } from "@/components/ui/skeleton";

export default function TripLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-surface" aria-busy="true">
      <div className="h-14 border-b border-border bg-background" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-10 w-2/3 max-w-md" />
        <Skeleton className="mt-3 h-5 w-64" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className="h-24 rounded-2xl" />
          ))}
        </div>

        <Skeleton className="mt-8 h-10 w-full max-w-lg" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Loading trip and itinerary...
        </p>
      </main>
    </div>
  );
}
