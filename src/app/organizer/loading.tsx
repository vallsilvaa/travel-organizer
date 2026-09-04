import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function OrganizerLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        {[0, 1, 2].map((index) => (
          <Card key={index} className="[--card-spacing:--spacing(8)]">
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
