import { useRef, useState } from "react";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import type { ChecklistCategory, ChecklistItem } from "@/lib/trips-api";
import { addChecklistItem, deleteChecklistItem, setChecklistItemDone } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { useOptimisticToggle } from "@/lib/use-optimistic-toggle";
import { cn } from "@/components/ui/utils";
import { TickBox } from "@/components/ui/tick-box";
import { ProgressOrbit, ProgressTrack } from "@/components/ProgressOrbit";
import { Input } from "@/components/ui/input";
import { CHECKLIST_CATEGORIES, categoryLabel, checklistMeta } from "./trip-categories";
import { checklistProgress } from "./trip-plan";
import type { TripBudget } from "./trip-plan";

/**
 * Everything that isn't a moment on the timeline: what the trip will cost, and
 * what has to be done before leaving.
 *
 * They share a tab because they share a question — "are we ready?" — and
 * because neither alone justifies a third of the segmented control.
 */
export function TripPrep({
  budget,
  checklist,
  tripId,
  onChanged,
}: {
  budget: TripBudget;
  checklist: ChecklistItem[];
  tripId: string;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      <BudgetPanel budget={budget} />
      <ChecklistPanel items={checklist} tripId={tripId} onChanged={onChanged} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

function BudgetPanel({ budget }: { budget: TripBudget }) {
  const hasAnything = budget.budget !== null || budget.planned > 0;

  if (!hasAnything) {
    return (
      <section className="glass-2 border-dashed border-violet-200 px-5 py-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-violet-100 text-primary">
          <Wallet className="size-5" />
        </span>
        <p className="mt-3 text-sm font-medium text-foreground">No costs yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Put a budget on the trip, and a cost on a stop or a place — the total keeps itself.
        </p>
      </section>
    );
  }

  const pct = budget.budget ? Math.round((budget.planned / budget.budget) * 100) : 0;
  const max = budget.lines[0]?.amount ?? 0;

  return (
    <section className="glass-2 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">Budget</h3>
        {budget.budget !== null && (
          <span
            className={cn(
              "font-numeric text-xs font-bold",
              budget.overBudget ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {pct}% planned
          </span>
        )}
      </div>

      {/* Stated as a sentence rather than a giant figure with a caption: the
          useful unit here is the comparison, not either number alone. */}
      <p className="mt-2 text-sm text-foreground">
        <span className="font-numeric font-bold">{formatAmount(budget.planned)}</span>
        {budget.budget !== null ? (
          <span className="text-muted-foreground"> planned of {formatAmount(budget.budget)}</span>
        ) : (
          <span className="text-muted-foreground"> planned — no budget set for this trip</span>
        )}
      </p>

      {budget.budget !== null && (
        <>
          {/* A full brand-gradient bar under the words "over budget" is a
              mixed signal — the instrument has to agree with the sentence. */}
          <ProgressTrack
            percent={budget.ratio * 100}
            tone={budget.overBudget ? "danger" : "brand"}
            label="Trip budget"
            className="mt-3"
          />
          <p
            className={cn(
              "font-numeric mt-2 text-sm font-bold",
              budget.overBudget ? "text-destructive" : "text-foreground",
            )}
          >
            {budget.overBudget
              ? `${formatAmount(Math.abs(budget.remaining ?? 0))} over budget`
              : `${formatAmount(budget.remaining ?? 0)} still free`}
          </p>
        </>
      )}

      {budget.estimated > 0 && (
        // The one rule of this rollup that isn't obvious, said once, where the
        // number it explains is.
        <p className="mt-2 text-xs text-muted-foreground">
          Includes {formatAmount(budget.estimated)} estimated on places you haven&apos;t scheduled yet.
        </p>
      )}

      {budget.lines.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {budget.lines.map((line) => (
            <li key={line.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">
                {categoryLabel(line.label) ?? "Other"}
              </span>
              {/* A share-of-total bar rather than a share-of-budget one: this
                  list answers "what is the money going on", and a trip with no
                  budget set would otherwise render every row at zero. */}
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary/45 transition-[width] duration-[var(--dur-4)] ease-[var(--ease-glide)]"
                  style={{ width: `${max > 0 ? (line.amount / max) * 100 : 0}%` }}
                />
              </span>
              <span className="font-numeric w-24 shrink-0 text-right text-xs font-semibold text-foreground">
                {formatAmount(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** One-tap starters for a list nobody has begun. Real, universal trip prep —
 *  not filler — so a first-run screen teaches the feature by producing
 *  something usable rather than describing it. */
const STARTERS: { title: string; category: ChecklistCategory }[] = [
  { title: "Passports", category: "documents" },
  { title: "Travel insurance", category: "documents" },
  { title: "Chargers & adapters", category: "packing" },
  { title: "Confirm the hotel", category: "bookings" },
  { title: "Tell the bank we're travelling", category: "todo" },
];

function ChecklistPanel({
  items,
  tripId,
  onChanged,
}: {
  items: ChecklistItem[];
  tripId: string;
  onChanged: () => void;
}) {
  const { done, total, percent } = checklistProgress(items);
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteChecklistItem(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't remove that line. Please try again.",
  });

  const visible = items.filter((i) => !pendingIds.has(i.id));

  // Buckets in a fixed order, and only the ones that have something in them —
  // four empty headers is a form, not a list.
  const buckets = CHECKLIST_CATEGORIES.map((meta) => ({
    meta,
    rows: visible.filter((i) => (i.category ?? "todo") === meta.value),
  })).filter((b) => b.rows.length > 0);

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="flex-1 text-sm font-bold text-foreground">Before we go</h3>
        {total > 0 && (
          <>
            <span className="font-numeric text-xs font-semibold text-muted-foreground">
              {done} of {total}
            </span>
            <ProgressOrbit percent={percent} size={30} stroke={4} label="Prep list" />
          </>
        )}
      </div>

      <QuickAdd tripId={tripId} onAdded={onChanged} />

      {total === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Nothing on the list yet. Tap one to start, or type your own above.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <StarterChip key={s.title} starter={s} tripId={tripId} onAdded={onChanged} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {buckets.map(({ meta, rows }) => (
            <div key={meta.value}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <meta.icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{meta.label}</h4>
              </div>
              <ul className="space-y-1">
                {rows.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    onChanged={onChanged}
                    onDelete={() => requestDelete(item.id, `Removed "${item.title}"`)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChecklistRow({
  item,
  onChanged,
  onDelete,
}: {
  item: ChecklistItem;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [isDone, setDone] = useOptimisticToggle(
    item.isDone,
    (next) => setChecklistItemDone(item.id, next),
    onChanged,
    "Couldn't save that. Please try again.",
  );

  return (
    <li
      data-checked={isDone}
      className={cn(
        "group flex items-center gap-3 rounded-md px-1 py-1 transition-opacity duration-[var(--dur-2)]",
        isDone && "opacity-60",
      )}
    >
      <TickBox checked={isDone} label={`Mark ${item.title} as done`} onChange={setDone} size="sm" />
      <span className={cn("min-w-0 flex-1 text-sm", isDone ? "text-muted-foreground" : "text-foreground")}>
        <span className="strike">{item.title}</span>
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${item.title}`}
        className={cn(
          "-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/45 outline-none",
          // Revealed on hover on a pointer device, always present for touch and
          // keyboard — a delete you can only reach with a mouse is no delete.
          "transition-[color,opacity] hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

/**
 * Inline quick-add, not a sheet.
 *
 * A prep list is written in bursts — five things in ten seconds — and a modal
 * per line turns that into five open-type-save cycles. The field keeps focus
 * and its bucket after each submit, so the next line is one keystroke away.
 */
function QuickAdd({ tripId, onAdded }: { tripId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ChecklistCategory>("packing");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await addChecklistItem({ tripId, title: value, category });
      setTitle("");
      onAdded();
      inputRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        {CHECKLIST_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={category === c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              "flex min-h-8 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[0.6875rem] font-semibold outline-none",
              "transition-[background-color,border-color,color] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              category === c.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card/70 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder={`Add to ${checklistMeta(category).label.toLowerCase()}…`}
          aria-label={`Add an item to ${checklistMeta(category).label}`}
          className="flex-1"
        />
        <button
          type="submit"
          disabled={!title.trim() || saving}
          aria-label="Add to the list"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-[background-color,opacity,transform] hover:bg-primary/90 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
        </button>
      </div>
    </form>
  );
}

function StarterChip({
  starter,
  tripId,
  onAdded,
}: {
  starter: { title: string; category: ChecklistCategory };
  tripId: string;
  onAdded: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [used, setUsed] = useState(false);

  return (
    <button
      type="button"
      disabled={saving || used}
      onClick={async () => {
        setSaving(true);
        try {
          await addChecklistItem({ tripId, title: starter.title, category: starter.category });
          setUsed(true);
          onAdded();
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Couldn't add that. Please try again.");
        } finally {
          setSaving(false);
        }
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-violet-200 bg-card/70 px-3 text-xs font-semibold text-foreground outline-none transition-[background-color,border-color,opacity] hover:border-primary/50 hover:bg-violet-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
    >
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 text-primary" />}
      {starter.title}
    </button>
  );
}
