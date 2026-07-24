import { useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { Pencil, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Trip, ItineraryItem } from "@/lib/trips-api";
import { deleteTrip } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { Fab } from "@/components/layout/Fab";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TripHero } from "@/components/trips/TripHero";
import { ItineraryItemSheet } from "@/components/trips/ItineraryItemSheet";
import { ItineraryList } from "@/components/trips/ItineraryList";

export default function TripDetailPage() {
  const { trip, itineraryItems } = useLoaderData() as { trip: Trip; itineraryItems: ItineraryItem[] };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);

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

  const count = itineraryItems.length;

  return (
    <div>
      <TripHero
        trip={trip}
        backTo="/trips"
        menuItems={[
          { label: "Edit trip", icon: Pencil, onSelect: () => navigate(`/trips/${trip.id}/edit`) },
          { label: "Delete trip", icon: Trash2, destructive: true, onSelect: () => setConfirmingDelete(true) },
        ]}
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12 pt-6">
        {trip.notes && <p className="whitespace-pre-line text-sm text-foreground">{trip.notes}</p>}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-sans text-xl font-semibold text-foreground">Itinerary</h2>
            {count > 0 && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {count} {count === 1 ? "stop" : "stops"}
              </span>
            )}
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-card px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Route className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="font-medium text-foreground">No activities yet</p>
                <p className="text-sm text-muted-foreground">Map out your days — add flights, stays, and things to do.</p>
              </div>
              <Button type="button" className="mt-1" onClick={() => setAddingActivity(true)}>
                <Plus className="size-4" />
                Add activity
              </Button>
            </div>
          ) : (
            <ItineraryList items={itineraryItems} onChanged={() => revalidator.revalidate()} />
          )}
        </div>
      </div>

      <Fab label="Add activity" onClick={() => setAddingActivity(true)} />

      <ItineraryItemSheet
        tripId={trip.id}
        open={addingActivity}
        onClose={() => setAddingActivity(false)}
        onAdded={() => revalidator.revalidate()}
      />

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
