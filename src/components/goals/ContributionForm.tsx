import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { MAX_MONEY_AMOUNT } from "@shared/validation";
import { contributeToGoal, type GoalType } from "@/lib/goals-api";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  onContributed,
}: {
  goalId: string;
  goalType: GoalType;
  onContributed: () => void;
}) {
  return goalType === "financial" ? (
    <FinancialContributionForm goalId={goalId} onContributed={onContributed} />
  ) : (
    <GeneralContributionForm goalId={goalId} onContributed={onContributed} />
  );
}

function FinancialContributionForm({ goalId, onContributed }: { goalId: string; onContributed: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FinancialFormValues>({
    resolver: zodResolver(financialFormSchema),
    defaultValues: { amount: 0, note: "" },
  });

  async function onSubmit(values: FinancialFormValues) {
    setServerError(null);
    try {
      await contributeToGoal({ goalType: "financial", goalId, amount: values.amount, note: values.note });
      form.reset({ amount: 0, note: "" });
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
                <Input type="number" step="0.01" min="0" max={MAX_MONEY_AMOUNT} placeholder="0.00" {...field} />
              </FormControl>
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

function GeneralContributionForm({ goalId, onContributed }: { goalId: string; onContributed: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: { newProgressPct: 0, note: "" },
  });

  async function onSubmit(values: GeneralFormValues) {
    setServerError(null);
    try {
      await contributeToGoal({
        goalType: "general",
        goalId,
        newProgressPct: values.newProgressPct,
        note: values.note,
      });
      form.reset({ newProgressPct: values.newProgressPct, note: "" });
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
              <FormLabel>New progress (%)</FormLabel>
              <FormControl>
                <Input type="number" step="1" min="0" max="100" {...field} />
              </FormControl>
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
