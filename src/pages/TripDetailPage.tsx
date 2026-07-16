import { useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Trip, ItineraryItem } from "@/lib/trips-api";
import { deleteTrip } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailMenu } from "@/components/layout/DetailMenu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItineraryItemForm } from "@/components/trips/ItineraryItemForm";
import { ItineraryList } from "@/components/trips/ItineraryList";

export default function TripDetailPage() {
  const { trip, itineraryItems } = useLoaderData() as { trip: Trip; itineraryItems: ItineraryItem[] };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      toast.success("Trip deleted");
      navigate("/trips");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the trip. Please try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const dateRange = trip.startDate
    ? trip.endDate && trip.endDate !== trip.startDate
      ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`
      : formatDate(trip.startDate)
    : undefined;

  return (
    <div>
      <PageHeader
        back={{ to: "/trips", label: "Trips" }}
        title={trip.title}
        description={[trip.destination, dateRange].filter(Boolean).join(" · ") || undefined}
        actions={
          <DetailMenu
            items={[
              { label: "Edit trip", icon: Pencil, onSelect: () => navigate(`/trips/${trip.id}/edit`) },
              { label: "Delete trip", icon: Trash2, destructive: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {(trip.budget || trip.notes) && (
          <div>
            {trip.budget && <p className="text-base font-semibold text-foreground">{formatAmount(trip.budget)} budget</p>}
            {trip.notes && <p className="mt-2 text-sm text-foreground">{trip.notes}</p>}
          </div>
        )}

        <div>
          <h2 className="mb-3 font-sans text-xl font-semibold text-foreground">Add to itinerary</h2>
          <ItineraryItemForm tripId={trip.id} onAdded={() => revalidator.revalidate()} />
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xl font-semibold text-foreground">Itinerary</h2>
          <ItineraryList items={itineraryItems} onChanged={() => revalidator.revalidate()} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this trip?"
        description="This removes the trip and its whole itinerary for both of you. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
