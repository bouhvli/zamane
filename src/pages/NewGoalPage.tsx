import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { goalTypeSchema, MAX_MONEY_AMOUNT, type CreateGoalRequest, type UpdateGoalRequest } from "@shared/validation";
import { createGoal, updateGoal, uploadGoalImage, type Goal } from "@/lib/goals-api";
import { optimizeImage } from "@/lib/image-optimize";
import { ApiError } from "@/lib/api";
import { useRouteDataFor } from "@/lib/use-route-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailSkeleton } from "@/components/layout/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const TYPE_OPTIONS = [
  { value: "financial", label: "Financial" },
  { value: "general", label: "General" },
] as const;

export default function NewGoalPage() {
  // Present only on the edit route (see router.tsx). Its absence used to mean
  // "create mode" and nothing else; now it can also mean "not here yet",
  // because the loader no longer waits for the payload. Every initial value in
  // the form below is read once at mount — useForm's defaultValues, the cover
  // state — so mounting before the record is in hand would produce an empty
  // form that silently ignores the data when it lands. `params.id` is what
  // tells the two cases apart.
  const { id } = useParams();
  const editData = useRouteDataFor<{ goal: Goal }>("goal-edit");

  if (id && !editData) return <DetailSkeleton cover={false} rows={4} />;

  return <GoalForm existing={editData?.goal} />;
}

function GoalForm({ existing }: { existing?: Goal }) {
  const navigate = useNavigate();
  const isEdit = Boolean(existing);

  const [serverError, setServerError] = useState<string | null>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cover image. `cover` is the persisted {url, publicId} sent on submit;
  // `coverPreview` is what we render (a local optimized data URL the instant a
  // file is picked, swapped for the hosted URL once upload succeeds).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<{ url: string; publicId: string } | null>(
    existing?.imageUrl ? { url: existing.imageUrl, publicId: existing.imagePublicId ?? "" } : null,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(existing?.imageUrl ?? null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;

    setCoverError(null);
    setCoverBusy(true);
    try {
      const { dataUrl } = await optimizeImage(file, { maxDim: 1600, quality: 0.82 });
      setCoverPreview(dataUrl); // instant local preview while it uploads
      const uploaded = await uploadGoalImage(dataUrl);
      setCover(uploaded);
      setCoverPreview(uploaded.url);
    } catch (error) {
      setCoverError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Couldn't add that image. Please try again.",
      );
      if (!cover) setCoverPreview(null); // failed first upload — don't imply success
    } finally {
      setCoverBusy(false);
    }
  }

  function removeImage() {
    setCover(null);
    setCoverPreview(null);
    setCoverError(null);
  }

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: existing
      ? {
          goalType: existing.goalType,
          title: existing.title,
          description: existing.description ?? "",
          targetAmount: existing.targetAmount ?? "",
          targetDate: existing.targetDate ? existing.targetDate.slice(0, 10) : "",
        }
      : { goalType: "financial", title: "", description: "", targetAmount: "", targetDate: "" },
  });

  const goalType = form.watch("goalType");

  function handleTypeKeyDown(event: React.KeyboardEvent, index: number) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (index + direction + TYPE_OPTIONS.length) % TYPE_OPTIONS.length;
    form.setValue("goalType", TYPE_OPTIONS[next].value, { shouldValidate: true });
    radioRefs.current[next]?.focus();
  }

  async function onSubmit(values: GoalFormValues) {
    setServerError(null);

    try {
      if (existing) {
        const payload: UpdateGoalRequest =
          existing.goalType === "financial"
            ? {
                goalType: "financial",
                id: existing.id,
                title: values.title,
                description: values.description,
                targetAmount: Number(values.targetAmount),
                targetDate: values.targetDate || undefined,
                imageUrl: cover?.url,
                imagePublicId: cover?.publicId,
              }
            : {
                goalType: "general",
                id: existing.id,
                title: values.title,
                description: values.description,
                targetDate: values.targetDate || undefined,
                imageUrl: cover?.url,
                imagePublicId: cover?.publicId,
              };
        await updateGoal(payload);
        toast.success("Goal updated");
        navigate(`/goals/${existing.id}`);
        return;
      }

      const payload: CreateGoalRequest =
        values.goalType === "financial"
          ? {
              goalType: "financial",
              title: values.title,
              description: values.description,
              targetAmount: Number(values.targetAmount),
              targetDate: values.targetDate || undefined,
              imageUrl: cover?.url,
              imagePublicId: cover?.publicId,
            }
          : {
              goalType: "general",
              title: values.title,
              description: values.description,
              targetDate: values.targetDate || undefined,
              imageUrl: cover?.url,
              imagePublicId: cover?.publicId,
            };
      const { goal } = await createGoal(payload);
      toast.success("Goal created");
      navigate(`/goals/${goal.id}`);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader
        back={isEdit ? { to: `/goals/${existing!.id}`, label: "Goal" } : { to: "/goals", label: "Goals" }}
        title={isEdit ? "Edit goal" : "New goal"}
        description={isEdit ? "Update the details below." : "Set something you're both working toward."}
      />

      <div className="mx-auto max-w-md px-4 pb-12">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Type is immutable once a goal exists (it determines how progress
                is measured), so the selector only appears when creating. */}
            {!isEdit && (
              <div>
                <div role="radiogroup" aria-label="Goal type" className="flex gap-2">
                  {TYPE_OPTIONS.map((option, index) => {
                    const selected = goalType === option.value;
                    return (
                      <button
                        key={option.value}
                        ref={(node) => {
                          radioRefs.current[index] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => form.setValue("goalType", option.value, { shouldValidate: true })}
                        onKeyDown={(event) => handleTypeKeyDown(event, index)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-[color,background-color,border-color,transform] active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          selected
                            ? "border-primary bg-violet-100 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {goalType === "financial"
                    ? "Financial goals track a money target you save toward together."
                    : "General goals track progress as a percentage — great for non-money goals."}
                </p>
              </div>
            )}

            {/* Cover image — optional, but it makes a goal feel real and
                turns the list into something aspirational to scroll. Optimized
                on-device before it ever hits the network. */}
            <div>
              <label className="mb-1.5 block text-base font-medium">Cover image (optional)</label>
              {coverPreview ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-muted">
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                  {coverBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      <Loader2 className="size-6 animate-spin" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={coverBusy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors hover:bg-white focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-60"
                    >
                      <ImagePlus className="size-3.5" />
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      aria-label="Remove cover image"
                      className="inline-flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm outline-none transition-colors hover:bg-black/70 focus-visible:ring-[3px] focus-visible:ring-white/70"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={coverBusy}
                  className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-input-background/60 text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {coverBusy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                  <span className="text-sm font-medium text-foreground">{coverBusy ? "Adding…" : "Add a photo"}</span>
                  <span className="text-xs">JPG, PNG or WebP — resized automatically</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onPickImage}
                tabIndex={-1}
              />
              {coverError && (
                <p role="alert" className="mt-1.5 text-sm text-destructive">
                  {coverError}
                </p>
              )}
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
                    <Textarea placeholder="A short note about this goal" {...field} />
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

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || coverBusy}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create goal"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
