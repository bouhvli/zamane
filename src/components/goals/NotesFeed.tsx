import { Trash2 } from "lucide-react";

import type { GoalNote } from "@/lib/goals-api";
import { deleteGoalNote } from "@/lib/goals-api";
import { noteImageUrl } from "@/lib/goal-image";
import { formatRelativeDate, initials } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { Button } from "@/components/ui/button";

// The goal's "continuous note" journal — newest first. Deletion is undoable
// (optimistic hide + toast with Undo), matching the contributions list.
export function NotesFeed({ notes, onChanged }: { notes: GoalNote[]; onChanged: () => void }) {
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteGoalNote(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't remove the note. Please try again.",
  });

  const visible = notes.filter((note) => !pendingIds.has(note.id));
  if (visible.length === 0) return null;

  return (
    <ul className="space-y-4">
      {visible.map((note) => (
        <NoteItem key={note.id} note={note} onDelete={() => requestDelete(note.id, "Note removed")} />
      ))}
    </ul>
  );
}

function NoteItem({ note, onDelete }: { note: GoalNote; onDelete: () => void }) {
  const who = note.displayName || note.email.split("@")[0];

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(26,15,20,0.04),0_8px_22px_-14px_rgba(26,15,20,0.16)]">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground"
        >
          {initials(who)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{who}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDate(note.createdAt)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-1.5 size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${who}'s note`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="space-y-2.5 px-4 pt-2 pb-4">
        {note.blocks.map((block, index) =>
          block.type === "text" ? (
            <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {block.value}
            </p>
          ) : (
            <img
              key={index}
              src={noteImageUrl(block.url, 1000)}
              alt=""
              loading="lazy"
              className="w-full rounded-lg border border-border/60 bg-muted object-cover"
              style={block.width && block.height ? { aspectRatio: `${block.width} / ${block.height}` } : undefined}
            />
          ),
        )}
      </div>
    </li>
  );
}
