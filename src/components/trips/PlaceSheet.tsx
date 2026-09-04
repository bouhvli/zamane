import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import type { TripPlace } from "@/lib/trips-api";
import { addTripPlace, updateTripPlace } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { CURRENCY } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/components/ui/utils";
import { tripCategorySchema } from "@shared/validation";
import { TRIP_CATEGORIES } from "./trip-categories";
import { SheetShell } from "./SheetShell";

const placeFormSchema = z.object({
  name: z.string().trim().min(1, "Give the place a name").max(120),
  category: tripCategorySchema.or(z.literal("")),
  area: z.string().trim().max(160).optional(),
  estCost: z.string().optional(),
  url: z
    .string()
    .trim()
    .max(600)
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Enter a full link, starting with https://"),
  notes: z.string().trim().max(1000).optional(),
  isPriority: z.boolean(),
});
type PlaceFormValues = z.infer<typeof placeFormSchema>;

const EMPTY: PlaceFormValues = {
  name: "",
  category: "",
  area: "",
  estCost: "",
  url: "",
  notes: "",
  isPriority: false,
};

/** Null closes; `"new"` opens an empty form; a place opens it for editing. */
export type PlaceDraft = "new" | TripPlace | null;

export function PlaceSheet({
  tripId,
  draft,
  onClose,
  onSaved,
}: {
  tripId: string;
  draft: PlaceDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = draft !== null && draft !== "new" ? draft : null;

  const defaults = useMemo<PlaceFormValues>(() => {
    if (!editing) return EMPTY;
    return {
      name: editing.name,
      category: editing.category ?? "",
      area: editing.area ?? "",
      estCost: editing.estCost ? String(Number(editing.estCost)) : "",
      url: editing.url ?? "",
      notes: editing.notes ?? "",
      isPriority: editing.isPriority,
    };
  }, [editing]);

  const form = useForm<PlaceFormValues>({ resolver: zodResolver(placeFormSchema), defaultValues: EMPTY });
  const isSubmitting = form.formState.isSubmitting;
  const category = form.watch("category");
  const isPriority = form.watch("isPriority");

  useEffect(() => {
    if (draft === null) return;
    setServerError(null);
    form.reset(defaults);
  }, [draft, defaults, form]);

  async function onSubmit(values: PlaceFormValues) {
    setServerError(null);
    const payload = {
      name: values.name,
      category: values.category || undefined,
      area: values.area || undefined,
      notes: values.notes || undefined,
      url: values.url || undefined,
      estCost: values.estCost === "" ? undefined : values.estCost,
      isPriority: values.isPriority,
    };

    try {
      if (editing) {
        await updateTripPlace({ id: editing.id, ...payload });
        toast.success("Place updated");
      } else {
        await addTripPlace({ tripId, ...payload });
        toast.success("Saved to places");
      }
      onSaved();
      onClose();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <SheetShell
      open={draft !== null}
      onClose={onClose}
      locked={isSubmitting}
      title={editing ? "Edit place" : "Save a place"}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Place</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Vigeland Sculpture Park" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Kind</p>
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
              name="area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Frogner, west side" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rough cost</FormLabel>
                  <FormControl>
                    <div className="relative">
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
                  {/* States the one non-obvious rule of the budget rollup. */}
                  <p className="text-xs text-muted-foreground">
                    Counted in the trip budget until this place is scheduled — then its stop's cost takes over.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link</FormLabel>
                  <FormControl>
                    <Input type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" {...field} />
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
                    <Textarea placeholder="Why you want to go, opening hours, who recommended it…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="button"
              aria-pressed={isPriority}
              onClick={() => form.setValue("isPriority", !isPriority, { shouldDirty: true })}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-3 text-left outline-none",
                "transition-[background-color,border-color] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isPriority ? "border-accent/40 bg-rose-50" : "border-border bg-card hover:bg-muted",
              )}
            >
              <Star
                aria-hidden="true"
                className={cn(
                  "size-5 shrink-0 transition-[color,transform] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                  isPriority ? "scale-110 fill-accent text-accent" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Must-do</span>
                <span className="block text-xs text-muted-foreground">Sorts to the top of the board</span>
              </span>
            </button>

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
              {editing ? "Save" : "Save place"}
            </Button>
          </div>
        </form>
      </Form>
    </SheetShell>
  );
}
