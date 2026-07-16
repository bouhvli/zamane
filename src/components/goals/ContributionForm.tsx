import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MAX_MONEY_AMOUNT } from "@shared/validation";
import { contributeToGoal, type GoalType, type Goal } from "@/lib/goals-api";
import { ApiError } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Acknowledge the contribution — this is the app's core moment (two people
// moving toward a shared goal) and it previously happened silently. When the
// goal tips over its target the message shifts to a shared celebration.
function announceContribution(goal: Goal, addedLabel: string) {
  if (goal.isCompleted) {
    toast.success("Goal reached — you did it together! 🎉");
    return;
  }
  const percent = goal.targetAmount
    ? Math.round((Number(goal.currentAmount) / Number(goal.targetAmount)) * 100)
    : goal.currentProgressPct;
  toast.success(`${addedLabel} — ${percent}% there`);
}

// Two concrete (non-union) form schemas, kept separate from the API's
// discriminated ContributeRequest type — react-hook-form's Path<T> doesn't
// resolve field names cleanly against a union type, so each variant gets
// its own plain schema and assembles the discriminated payload on submit.

const financialFormSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").max(MAX_MONEY_AMOUNT, "Amount is too large"),
  note: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
});
type FinancialFormValues = z.infer<typeof financialFormSchema>;

const generalFormSchema = z.object({
  newProgressPct: z.coerce.number().int().min(0).max(100),
  note: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
});
type GeneralFormValues = z.infer<typeof generalFormSchema>;

export function ContributionForm({
  goalId,
  goalType,
  currentProgressPct,
  onContributed,
}: {
  goalId: string;
  goalType: GoalType;
  currentProgressPct: number;
  onContributed: () => void;
}) {
  return goalType === "financial" ? (
    <FinancialContributionForm goalId={goalId} onContributed={onContributed} />
  ) : (
    <GeneralContributionForm goalId={goalId} currentProgressPct={currentProgressPct} onContributed={onContributed} />
  );
}

const QUICK_AMOUNTS = [10, 25, 50, 100];

function FinancialContributionForm({ goalId, onContributed }: { goalId: string; onContributed: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FinancialFormValues>({
    resolver: zodResolver(financialFormSchema),
    // No literal 0 default — it forced the user to clear the field first. An
    // empty field shows the placeholder and, if submitted empty, fails the
    // "greater than 0" rule rather than silently sending a zero contribution.
    defaultValues: { amount: undefined, note: "" },
  });

  async function onSubmit(values: FinancialFormValues) {
    setServerError(null);
    try {
      const { goal } = await contributeToGoal({
        goalType: "financial",
        goalId,
        amount: values.amount,
        note: values.note,
      });
      form.reset({ amount: undefined, note: "" });
      announceContribution(goal, `${formatAmount(values.amount)} added`);
      onContributed();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
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
                    inputMode="decimal"
                    {...field}
                    value={field.value ?? ""}
                  />
                </div>
              </FormControl>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    // Additive, matching the "+" label: tapping +$25 twice = $50.
                    onClick={() => {
                      const current = Number(form.getValues("amount")) || 0;
                      form.setValue("amount", Math.round((current + amount) * 100) / 100, { shouldValidate: true });
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    +{formatAmount(amount)}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Add a note" {...field} />
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
          Contribute
        </Button>
      </form>
    </Form>
  );
}

function GeneralContributionForm({
  goalId,
  currentProgressPct,
  onContributed,
}: {
  goalId: string;
  currentProgressPct: number;
  onContributed: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    // Pre-fill with the current total so the field reads as "where you are now"
    // — editing 60 → 70 — instead of an empty/zero box that invites someone to
    // type an increment and accidentally reset a goal backwards.
    defaultValues: { newProgressPct: currentProgressPct, note: "" },
  });

  async function onSubmit(values: GeneralFormValues) {
    setServerError(null);
    try {
      const { goal } = await contributeToGoal({
        goalType: "general",
        goalId,
        newProgressPct: values.newProgressPct,
        note: values.note,
      });
      form.reset({ newProgressPct: values.newProgressPct, note: "" });
      announceContribution(goal, "Progress updated");
      onContributed();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="newProgressPct"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Progress so far (%)</FormLabel>
              <FormControl>
                <Input type="number" step="1" min="0" max="100" inputMode="numeric" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">Your total progress toward the goal, not the amount you're adding.</p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Add a note" {...field} />
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
          Update progress
        </Button>
      </form>
    </Form>
  );
}
