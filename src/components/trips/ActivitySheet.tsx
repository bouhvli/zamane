import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { ItineraryItem, TripPlace } from "@/lib/trips-api";
import { addItineraryItem, updateItineraryItem } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { CURRENCY } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/components/ui/utils";
import { tripCategorySchema } from "@shared/validation";
import { TRIP_CATEGORIES, categoryHint } from "./trip-categories";
import { SheetShell } from "./SheetShell";

const activityFormSchema = z.object({
  title: z.string().trim().min(1, "Give the stop a name").max(120),
  // "" is the real "no kind chosen" value here — the chips toggle back to it —
  // and it's also what the request schema normalizes away, so the form and the
  // wire agree without a cast in between.
  category: tripCategorySchema.or(z.literal("")),
  itemDate: z.string().optional(),
  itemTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().trim().max(160).optional(),
  cost: z.string().optional(),
  url: z
    .string()
    .trim()
    .max(600)
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Enter a full link, starting with https://"),
  notes: z.string().trim().max(1000).optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;

const EMPTY: ActivityFormValues = {
  title: "",
  category: "",
  itemDate: "",
  itemTime: "",
  endTime: "",
  location: "",
  cost: "",
  url: "",
  notes: "",
};

/**
 * What the sheet is opening for. One sheet covers all three because they are
 * the same form with different starting values — a second "schedule a place"
 * sheet would be the same fields with a different title, and the two would
 * drift apart on the first change to either.
 */
export type ActivityDraft =
  | { mode: "create"; dayKey?: string; place?: TripPlace }
  | { mode: "edit"; item: ItineraryItem };

/** Postgres hands back `date` as "YYYY-MM-DD" (or an ISO timestamp) and `time`
 *  as "HH:MM:SS". Both inputs want the short forms and silently render blank
 *  otherwise — which reads as "the date didn't save". */
const asDateValue = (v: string | null) => (v ? v.slice(0, 10) : "");
const asTimeValue = (v: string | null) => (v ? v.slice(0, 5) : "");

export function ActivitySheet({
  tripId,
  draft,
  onClose,
  onSaved,
}: {
  tripId: string;
  /** Null closes the sheet. Passing a fresh object reopens it with new
   *  defaults, which is what makes "edit this stop" and "add to Tuesday"
   *  share one component. */
  draft: ActivityDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const placeIdRef = useRef<string | undefined>(undefined);

  const defaults = useMemo<ActivityFormValues>(() => {
    if (!draft) return EMPTY;
    if (draft.mode === "edit") {
      const i = draft.item;
      return {
        title: i.title,
        category: i.category ?? "",
        itemDate: asDateValue(i.itemDate),
        itemTime: asTimeValue(i.itemTime),
        endTime: asTimeValue(i.endTime),
        location: i.location ?? "",
        cost: i.cost ? String(Number(i.cost)) : "",
        url: i.url ?? "",
        notes: i.notes ?? "",
      };
    }
    // Scheduling a saved place: carry everything the place already knows, so
    // the only thing left to decide is when.
    const p = draft.place;
    return {
      ...EMPTY,
      itemDate: draft.dayKey ?? "",
      title: p?.name ?? "",
      category: p?.category ?? "",
      location: p?.area ?? "",
      cost: p?.estCost ? String(Number(p.estCost)) : "",
      url: p?.url ?? "",
      notes: p?.notes ?? "",
    };
  }, [draft]);

  const form = useForm<ActivityFormValues>({ resolver: zodResolver(activityFormSchema), defaultValues: EMPTY });
  const isSubmitting = form.formState.isSubmitting;
  const category = form.watch("category");

  useEffect(() => {
    if (!draft) return;
    setServerError(null);
    form.reset(defaults);
    placeIdRef.current = draft.mode === "edit" ? (draft.item.placeId ?? undefined) : draft.place?.id;
    // Details start collapsed for a new stop and open when editing something
    // that already has them — otherwise an edit would hide half the values
    // behind a link the user has to find.
    setShowMore(
      draft.mode === "edit" &&
        Boolean(draft.item.notes || draft.item.url || draft.item.cost || draft.item.location),
    );
  }, [draft, defaults, form]);

  async function onSubmit(values: ActivityFormValues) {
    setServerError(null);
    const payload = {
      title: values.title,
      category: values.category || undefined,
      itemDate: values.itemDate || undefined,
      itemTime: values.itemTime || undefined,
      endTime: values.endTime || undefined,
      location: values.location || undefined,
      notes: values.notes || undefined,
      cost: values.cost === "" ? undefined : values.cost,
      url: values.url || undefined,
      placeId: placeIdRef.current,
    };

    try {
      if (draft?.mode === "edit") {
        await updateItineraryItem({ id: draft.item.id, ...payload });
        toast.success("Stop updated");
      } else {
        await addItineraryItem({ tripId, ...payload });
        toast.success("Added to the plan");
      }
      onSaved();
      onClose();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  const editing = draft?.mode === "edit";

  return (
    <SheetShell
      open={draft !== null}
      onClose={onClose}
      locked={isSubmitting}
      title={editing ? "Edit stop" : draft?.place ? `Schedule ${draft.place.name}` : "Add a stop"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-2">
            {/* Kind first: it changes the placeholder below it, so choosing one
                teaches what the field wants instead of leaving a blank box. */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">What kind of stop?</p>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TRIP_CATEGORIES.map((c) => {
                  const selected = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => form.setValue("category", selected ? "" : c.value, { shouldDirty: true })}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold outline-none",
                        "transition-[background-color,border-color,color,transform] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                        "active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        selected
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <c.icon aria-hidden="true" className="size-3.5" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stop</FormLabel>
                  <FormControl>
                    <Input placeholder={categoryHint(category)} autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="itemDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  {/* Says what happens if you leave it blank, rather than
                      letting the user guess it's required. */}
                  <p className="text-xs text-muted-foreground">
                    Leave empty to park this under “Not scheduled yet”.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="itemTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starts</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ends</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              An end time is what lets the timeline show this as happening now.
            </p>

            <button
              type="button"
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
              className="inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-semibold text-primary outline-none transition-colors hover:text-violet-700 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {showMore ? "Fewer details" : "Where, cost, link, notes"}
            </button>

            <div className="reveal" data-open={showMore}>
              <div>
                <div className="space-y-4 pt-1">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Where</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Geirangerfjord" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost</FormLabel>
                        <FormControl>
                          <div className="relative">
                            {/* The symbol lives inside the field so it can't
                                disagree with what formatAmount renders — it did
                                once, and every figure read in a currency the
                                input never mentioned. */}
                            <span className="font-numeric pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                              {CURRENCY}
                            </span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              className="font-numeric pl-14"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking link</FormLabel>
                        <FormControl>
                          <Input type="url" inputMode="url" placeholder="https://…" {...field} />
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
                </div>
              </div>
            </div>

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2.5 border-t border-border bg-popover px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save" : "Add stop"}
            </Button>
          </div>
        </form>
      </Form>
    </SheetShell>
  );
}
