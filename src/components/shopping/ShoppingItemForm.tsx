import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { MAX_MONEY_AMOUNT } from "@shared/validation";
import { createShoppingItem } from "@/lib/shopping-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const shoppingFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999),
  category: z.string().trim().max(60).optional(),
  price: z.string().optional(),
});
type ShoppingFormValues = z.infer<typeof shoppingFormSchema>;

const DEFAULT_VALUES: ShoppingFormValues = { name: "", quantity: 1, category: "", price: "" };

export function ShoppingItemForm({ onAdded, categories = [] }: { onAdded: () => void; categories?: string[] }) {
  const [serverError, setServerError] = useState<string | null>(null);
  // The everyday action is "add a name and go", so the extra fields stay
  // tucked away behind a disclosure until the user actually wants them.
  const [showDetails, setShowDetails] = useState(false);
  const form = useForm<ShoppingFormValues>({
    resolver: zodResolver(shoppingFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: ShoppingFormValues) {
    setServerError(null);
    // Snap to an existing category that matches case-insensitively so
    // "groceries" and "Groceries" don't fork into two separate groups.
    const typedCategory = values.category?.trim();
    const category = typedCategory
      ? (categories.find((existing) => existing.toLowerCase() === typedCategory.toLowerCase()) ?? typedCategory)
      : undefined;
    try {
      await createShoppingItem({
        name: values.name,
        quantity: values.quantity,
        category,
        price: values.price ? Number(values.price) : undefined,
      });
      form.reset(DEFAULT_VALUES);
      // Keep focus in the name field so several items can be added in a row.
      form.setFocus("name");
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="Add an item…" aria-label="Item name" {...field} />
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
          {showDetails ? "Hide details" : "Add quantity, category, price"}
        </button>

        {showDetails && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qty</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="1" max="9999" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Category (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Groceries" list="shopping-categories" {...field} />
                    </FormControl>
                    {categories.length > 0 && (
                      <datalist id="shopping-categories">
                        {categories.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (optional)</FormLabel>
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
                      />
                    </div>
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
