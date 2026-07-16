import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useRouteLoaderData } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MAX_MONEY_AMOUNT, type CreateTripRequest, type UpdateTripRequest } from "@shared/validation";
import { createTrip, updateTrip, type Trip } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const tripFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    destination: z.string().trim().max(160).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    budget: z.string().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after the start date",
        path: ["endDate"],
      });
    }
    if (data.budget) {
      const amount = Number(data.budget);
      if (Number.isNaN(amount) || amount <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Budget must be greater than 0", path: ["budget"] });
      } else if (amount > MAX_MONEY_AMOUNT) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is too large", path: ["budget"] });
      }
    }
  });
type TripFormValues = z.infer<typeof tripFormSchema>;

export default function NewTripPage() {
  const navigate = useNavigate();
  // Present only on /trips/:id/edit (see router). Its absence means create mode.
  const editData = useRouteLoaderData("trip-edit") as { trip: Trip } | undefined;
  const existing = editData?.trip;
  const isEdit = Boolean(existing);

  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          destination: existing.destination ?? "",
          startDate: existing.startDate ? existing.startDate.slice(0, 10) : "",
          endDate: existing.endDate ? existing.endDate.slice(0, 10) : "",
          budget: existing.budget ?? "",
          notes: existing.notes ?? "",
        }
      : { title: "", destination: "", startDate: "", endDate: "", budget: "", notes: "" },
  });

  async function onSubmit(values: TripFormValues) {
    setServerError(null);

    try {
      if (existing) {
        const payload: UpdateTripRequest = {
          id: existing.id,
          title: values.title,
          destination: values.destination || undefined,
          startDate: values.startDate || undefined,
          endDate: values.endDate || undefined,
          budget: values.budget ? Number(values.budget) : undefined,
          notes: values.notes || undefined,
        };
        await updateTrip(payload);
        toast.success("Trip updated");
        navigate(`/trips/${existing.id}`);
        return;
      }

      const payload: CreateTripRequest = {
        title: values.title,
        destination: values.destination || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        budget: values.budget ? Number(values.budget) : undefined,
        notes: values.notes || undefined,
      };
      const { trip } = await createTrip(payload);
      toast.success("Trip created");
      navigate(`/trips/${trip.id}`);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader
        back={isEdit ? { to: `/trips/${existing!.id}`, label: "Trip" } : { to: "/trips", label: "Trips" }}
        title={isEdit ? "Edit trip" : "New trip"}
        description={isEdit ? "Update the details below." : "Plan something you're both looking forward to."}
      />

      <div className="mx-auto max-w-md px-4 pb-12">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Barcelona getaway" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Barcelona, Spain" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget (optional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={MAX_MONEY_AMOUNT}
                        placeholder="0.00"
                        className="pl-7"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A short note about this trip" {...field} />
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

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create trip"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
