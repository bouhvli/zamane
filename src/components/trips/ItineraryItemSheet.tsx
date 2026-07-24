import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { addItineraryItem } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const itineraryFormSchema = z.object({
  title: z.string().trim().min(1, "Give the activity a name").max(120),
  itemDate: z.string().optional(),
  itemTime: z.string().optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});
type ItineraryFormValues = z.infer<typeof itineraryFormSchema>;

const DEFAULT_VALUES: ItineraryFormValues = { title: "", itemDate: "", itemTime: "", location: "", notes: "" };

// The add-activity flow, recreated as a focused slide-up sheet (native
// <dialog>: focus trap, Escape, and a backdrop for free — same primitive as
// ConfirmDialog). Replaces the old always-open inline form that pushed the
// itinerary down the page; now the list is the page's focus and adding is a
// deliberate, uncluttered step triggered from the FAB.
export function ItineraryItemSheet({
  tripId,
  open,
  onClose,
  onAdded,
}: {
  tripId: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ItineraryFormValues>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const isSubmitting = form.formState.isSubmitting;

  // Drive the native modal from the `open` prop, and start every open from a
  // clean, focused form so a half-typed abandoned entry never lingers.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setServerError(null);
      form.reset(DEFAULT_VALUES);
      el.showModal();
      requestAnimationFrame(() => form.setFocus("title"));
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, form]);

  async function onSubmit(values: ItineraryFormValues) {
    setServerError(null);
    try {
      await addItineraryItem({
        tripId,
        title: values.title,
        itemDate: values.itemDate || undefined,
        itemTime: values.itemTime || undefined,
        location: values.location || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Added to itinerary");
      onAdded();
      onClose();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      // Route native Escape / backdrop dismissal back through our state so
      // `open` stays the source of truth (and can't close mid-submit).
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onClick={(event) => {
        // Click on the backdrop (the dialog element itself, outside its
        // content) dismisses — matching the tap-outside-to-close expectation.
        if (event.target === ref.current && !isSubmitting) onClose();
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-h-[92dvh] flex-col" noValidate>
          <div className="shrink-0 px-5 pt-3">
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Add activity</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 size-9 text-muted-foreground"
                aria-label="Close"
                onClick={onClose}
                disabled={isSubmitting}
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Visit the fjords" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="itemDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Geirangerfjord" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tickets, times, who's driving…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <div className="shrink-0 flex gap-2.5 border-t border-border bg-popover px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add activity
            </Button>
          </div>
        </form>
      </Form>
    </dialog>
  );
}
