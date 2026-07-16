import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { addItineraryItem } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const itineraryFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  itemDate: z.string().optional(),
  itemTime: z.string().optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});
type ItineraryFormValues = z.infer<typeof itineraryFormSchema>;

const DEFAULT_VALUES: ItineraryFormValues = { title: "", itemDate: "", itemTime: "", location: "", notes: "" };

export function ItineraryItemForm({ tripId, onAdded }: { tripId: string; onAdded: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  // Match the shopping list's grammar: name-and-go by default, the date/time/
  // location/notes fields behind a disclosure so the add-form doesn't push the
  // itinerary far down the page.
  const [showDetails, setShowDetails] = useState(false);
  const form = useForm<ItineraryFormValues>({
    resolver: zodResolver(itineraryFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

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
      form.reset(DEFAULT_VALUES);
      // Keep focus on the activity field to add several stops in a row.
      form.setFocus("title");
      onAdded();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="Add an activity…" aria-label="Activity" {...field} />
                </FormControl>
                <Button type="submit" className="shrink-0" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          aria-expanded={showDetails}
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showDetails && "rotate-180")} />
          {showDetails ? "Hide details" : "Add date, time, location, notes"}
        </button>

        {showDetails && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="itemDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date (optional)</FormLabel>
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
                    <FormLabel>Time (optional)</FormLabel>
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
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Sagrada Familia" {...field} />
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
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add a note" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
      </form>
    </Form>
  );
}
