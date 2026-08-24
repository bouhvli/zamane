import { MapPin } from "lucide-react";

import type { Trip, TripsSummary } from "@/lib/trips-api";
import { useRouteData } from "@/lib/use-route-data";
import { formatAmount } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSkeleton } from "@/components/layout/Skeleton";
import { Fab } from "@/components/layout/Fab";
import { EmptyState } from "@/components/layout/EmptyState";
import { TripCard } from "@/components/trips/TripCard";

export default function TripsPage() {
  // `undefined` until the payload lands — see src/lib/use-route-data.ts.
  const data = useRouteData<{ trips: Trip[]; summary: TripsSummary }>();

  if (!data) return <PageSkeleton cards={3} cardHeight="h-[196px]" />;

  const { trips, summary } = data;

  return (
    <div>
      <PageHeader
        title="Trips"
        description={trips.length === 0 ? "No trips yet — plan your first one together." : "Where you're headed next."}
        stats={[
          { label: "upcoming", value: String(summary.upcomingCount) },
          { label: "total budget", value: formatAmount(summary.totalBudget) },
          { label: "trips", value: String(trips.length) },
        ]}
      />

      <div className="stagger mx-auto max-w-md space-y-3 px-4 pb-12">
        {trips.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No trips yet"
            description="Plan your next adventure together."
            action={{ to: "/trips/new", label: "Plan a trip" }}
          />
        ) : (
          trips.map((trip) => <TripCard key={trip.id} trip={trip} />)
        )}
      </div>

      <Fab to="/trips/new" label="New trip" />
    </div>
  );
}
