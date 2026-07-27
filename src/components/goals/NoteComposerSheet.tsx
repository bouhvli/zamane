import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import type { NoteBlock } from "@/lib/goals-api";
import { createGoalNote, uploadGoalImage } from "@/lib/goals-api";
import { optimizeImage } from "@/lib/image-optimize";
import { ApiError } from "@/lib/api";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";

// Draft blocks carry a stable key + transient upload state; on save they're
// distilled down to the persisted NoteBlock shape.
type DraftText = { key: string; type: "text"; value: string };
type DraftImage = {
  key: string;
  type: "image";
  previewUrl: string;
  status: "uploading" | "done" | "error";
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
};
type DraftBlock = DraftText | DraftImage;

const uid = () => crypto.randomUUID();
const freshDraft = (): DraftBlock[] => [{ key: uid(), type: "text", value: "" }];

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

// The block-based note composer. You type paragraphs; tapping "Add photo"
// drops an image right after the paragraph your caret is in (and opens a fresh
// paragraph below it), so a picture can land at any position. Images are
// optimized on-device and uploaded to Cloudinary as you go; Save is blocked
// until every image has finished.
export function NoteComposerSheet({
  open,
  onClose,
  goalId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  goalId: string;
  onAdded: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<DraftBlock[]>(freshDraft);
  const [focusedKey, setFocusedKey] = useState<string>("");
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Drive the native modal from `open`, resetting to a clean draft each time.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      const start = freshDraft();
      setDraft(start);
      setFocusedKey(start[0].key);
      setAutoFocusKey(start[0].key);
      setServerError(null);
      setSubmitting(false);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const uploading = draft.some((b) => b.type === "image" && b.status === "uploading");
  const hasContent = draft.some(
    (b) => (b.type === "image" && b.status === "done") || (b.type === "text" && b.value.trim().length > 0),
  );
  const canSave = !submitting && !uploading && hasContent;

  function updateText(key: string, value: string) {
    setDraft((prev) => prev.map((b) => (b.key === key && b.type === "text" ? { ...b, value } : b)));
  }

  function removeBlock(key: string) {
    setDraft((prev) => {
      const next = prev.filter((b) => b.key !== key);
      return next.length ? next : freshDraft();
    });
  }

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setServerError(null);

    let optimized;
    try {
      optimized = await optimizeImage(file, { maxDim: 1600, quality: 0.82 });
    } catch (error) {
      setServerError(errorMessage(error, "Couldn't read that image."));
      return;
    }

    const imageKey = uid();
    const textKey = uid();
    const imageBlock: DraftImage = {
      key: imageKey,
      type: "image",
      previewUrl: optimized.dataUrl,
      status: "uploading",
      width: optimized.width,
      height: optimized.height,
    };
    const textBlock: DraftText = { key: textKey, type: "text", value: "" };

    // Insert the image (and a new paragraph) right after the focused block.
    setDraft((prev) => {
      const idx = prev.findIndex((b) => b.key === focusedKey);
      const at = idx === -1 ? prev.length - 1 : idx;
      return [...prev.slice(0, at + 1), imageBlock, textBlock, ...prev.slice(at + 1)];
    });
    setFocusedKey(textKey);
    setAutoFocusKey(textKey);

    try {
      const { url, publicId } = await uploadGoalImage(optimized.dataUrl);
      setDraft((prev) => prev.map((b) => (b.key === imageKey ? { ...b, status: "done", url, publicId } : b)));
    } catch (error) {
      setDraft((prev) => prev.map((b) => (b.key === imageKey ? { ...b, status: "error" } : b)));
      setServerError(errorMessage(error, "Couldn't upload that image."));
    }
  }

  async function onSave() {
    if (!canSave) return;
    const blocks: NoteBlock[] = [];
    for (const b of draft) {
      if (b.type === "text") {
        const value = b.value.trim();
        if (value) blocks.push({ type: "text", value });
      } else if (b.status === "done" && b.url && b.publicId) {
        blocks.push({ type: "image", url: b.url, publicId: b.publicId, width: b.width, height: b.height });
      }
    }
    if (blocks.length === 0) {
      setServerError("Write something first.");
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      await createGoalNote({ goalId, blocks });
      toast.success("Note added");
      onAdded();
      onClose();
    } catch (error) {
      setServerError(errorMessage(error, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="shrink-0 px-5 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Add note</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 size-9 text-muted-foreground"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2">
          <div className="space-y-2">
            {draft.map((block) =>
              block.type === "text" ? (
                <AutoGrowTextarea
                  key={block.key}
                  value={block.value}
                  autoFocus={block.key === autoFocusKey}
                  onChange={(value) => updateText(block.key, value)}
                  onFocus={() => setFocusedKey(block.key)}
                />
              ) : (
                <ImageBlockView key={block.key} block={block} onRemove={() => removeBlock(block.key)} />
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-input px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <ImagePlus className="size-4" />
            Add photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onPickFile}
            tabIndex={-1}
          />

          {serverError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2.5 border-t border-border bg-popover px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={onSave} disabled={!canSave}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {uploading ? "Uploading…" : "Save note"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  onFocus,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit content instead of scrolling inside a fixed box.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder="Write about this goal…"
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      className="w-full resize-none bg-transparent text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
    />
  );
}

function ImageBlockView({ block, onRemove }: { block: DraftImage; onRemove: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border bg-muted"
      style={block.width && block.height ? { aspectRatio: `${block.width} / ${block.height}` } : undefined}
    >
      <img
        src={block.previewUrl}
        alt=""
        className={cn("h-full w-full object-cover", block.status !== "done" && "opacity-70")}
      />
      {block.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      {block.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/70 text-center text-white">
          <span className="text-sm font-semibold">Upload failed</span>
          <span className="text-xs">Remove and try again</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm outline-none transition-colors hover:bg-black/70 focus-visible:ring-[3px] focus-visible:ring-white/70"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
