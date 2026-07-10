import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { goalTypeSchema, MAX_MONEY_AMOUNT, type CreateGoalRequest } from "@shared/validation";
import { createGoal } from "@/lib/goals-api";
import { ApiError } from "@/lib/api";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// A single concrete (non-union) form schema — react-hook-form's Path<T>
// doesn't resolve field names cleanly against the API's discriminated
// CreateGoalRequest type, so the form validates a superset shape and the
// correctly-shaped request is assembled on submit.
const goalFormSchema = z
  .object({
    goalType: goalTypeSchema,
    title: z.string().trim().min(1, "Title is required").max(120),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    targetAmount: z.string().optional(),
    targetDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.goalType === "financial") {
      const amount = Number(data.targetAmount);
      if (!data.targetAmount || Number.isNaN(amount) || amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Target amount must be greater than 0",
          path: ["targetAmount"],
        });
      } else if (amount > MAX_MONEY_AMOUNT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount is too large",
          path: ["targetAmount"],
        });
      }
    }
  });
type GoalFormValues = z.infer<typeof goalFormSchema>;

export default function NewGoalPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { goalType: "financial", title: "", description: "", targetAmount: "", targetDate: "" },
  });

  const goalType = form.watch("goalType");

  async function onSubmit(values: GoalFormValues) {
    setServerError(null);
    const payload: CreateGoalRequest =
      values.goalType === "financial"
        ? {
            goalType: "financial",
            title: values.title,
            description: values.description,
            targetAmount: Number(values.targetAmount),
            targetDate: values.targetDate || undefined,
          }
        : {
            goalType: "general",
            title: values.title,
            description: values.description,
            targetDate: values.targetDate || undefined,
          };

    try {
      const { goal } = await createGoal(payload);
      toast.success("Goal created");
      navigate(`/goals/${goal.id}`);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <PageHero label="GOALS" value="New goal" description="Set something you're both working toward." />

      <div className="mx-auto max-w-md px-4 pb-12">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div role="radiogroup" aria-label="Goal type" className="flex gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={goalType === "financial"}
                onClick={() => form.setValue("goalType", "financial", { shouldValidate: true })}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-[color,background-color,border-color,transform] active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  goalType === "financial"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                Financial
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={goalType === "general"}
                onClick={() => form.setValue("goalType", "general", { shouldValidate: true })}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-[color,background-color,border-color,transform] active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  goalType === "general"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                General
              </button>
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Trip to Barcelona" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="A short note about this goal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {goalType === "financial" && (
              <FormField
                control={form.control}
                name="targetAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={MAX_MONEY_AMOUNT}
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
              Create goal
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
