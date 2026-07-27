import { apiFetch } from "./api";
import type {
  CreateGoalRequest,
  UpdateGoalRequest,
  ContributeRequest,
  CreateGoalNoteRequest,
  NoteBlock,
} from "@shared/validation";

export type { NoteBlock } from "@shared/validation";

export type GoalType = "financial" | "general";

// Postgres `numeric` columns come back as strings (to avoid float
// precision loss) — parse with Number() at display time.
export type Goal = {
  id: string;
  title: string;
  description: string | null;
  goalType: GoalType;
  targetAmount: string | null;
  currentAmount: string;
  currentProgressPct: number;
  targetDate: string | null;
  /** Cloudinary secure_url of the cover image, or null. Delivery transforms
   *  are applied at render time — see goalImageUrl(). */
  imageUrl: string | null;
  /** Cloudinary public id (returned by detail/create; used to preserve or
   *  clean up the asset on edit/delete). Absent from the list payload. */
  imagePublicId?: string | null;
  isCompleted: boolean;
  createdBy?: string;
  createdByName?: string | null;
  createdByEmail?: string;
  createdAt: string;
};

export type GoalsSummary = {
  activeCount: number;
  completedCount: number;
  totalSavedThisMonth: string;
};

export type Contribution = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  amount: string | null;
  progressDelta: number | null;
  newProgressPct: number | null;
  note: string | null;
  createdAt: string;
};

// A note in a goal's shared journal — an ordered list of text/image blocks.
export type GoalNote = {
  id: string;
  blocks: NoteBlock[];
  createdBy: string;
  displayName: string | null;
  email: string;
  createdAt: string;
};

export function fetchGoals() {
  return apiFetch<{ goals: Goal[]; summary: GoalsSummary }>("/api/goals/list");
}

export function fetchGoalDetail(id: string) {
  return apiFetch<{ goal: Goal; contributions: Contribution[]; notes: GoalNote[] }>(
    `/api/goals/detail?id=${encodeURIComponent(id)}`,
  );
}

export type UploadedImage = { url: string; publicId: string };

/** Uploads an already-optimized image (base64 data URL) and returns its
 *  Cloudinary URL + public id. See src/lib/image-optimize.ts. */
export function uploadGoalImage(dataUrl: string) {
  return apiFetch<UploadedImage>("/api/goals/upload-image", { method: "POST", body: { dataUrl } });
}

export function createGoal(data: CreateGoalRequest) {
  return apiFetch<{ goal: Goal }>("/api/goals/create", { method: "POST", body: data });
}

export function updateGoal(data: UpdateGoalRequest) {
  return apiFetch<{ ok: true }>("/api/goals/update", { method: "POST", body: data });
}

export function deleteGoal(id: string) {
  return apiFetch<{ ok: true }>("/api/goals/delete", { method: "POST", body: { id } });
}

export function contributeToGoal(data: ContributeRequest) {
  return apiFetch<{ goal: Goal; contribution: Contribution }>("/api/goals/contribute", {
    method: "POST",
    body: data,
  });
}

export function deleteContribution(id: string) {
  return apiFetch<{ ok: true }>("/api/goals/contribution-delete", { method: "POST", body: { id } });
}

export function createGoalNote(data: CreateGoalNoteRequest) {
  return apiFetch<{ note: GoalNote }>("/api/goals/note-create", { method: "POST", body: data });
}

export function deleteGoalNote(id: string) {
  return apiFetch<{ ok: true }>("/api/goals/note-delete", { method: "POST", body: { id } });
}
