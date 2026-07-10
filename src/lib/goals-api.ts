import { apiFetch } from "./api";
import type { CreateGoalRequest, ContributeRequest } from "@shared/validation";

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

export function fetchGoals() {
  return apiFetch<{ goals: Goal[]; summary: GoalsSummary }>("/api/goals/list");
}

export function fetchGoalDetail(id: string) {
  return apiFetch<{ goal: Goal; contributions: Contribution[] }>(`/api/goals/detail?id=${encodeURIComponent(id)}`);
}

export function createGoal(data: CreateGoalRequest) {
  return apiFetch<{ goal: Goal }>("/api/goals/create", { method: "POST", body: data });
}

export function contributeToGoal(data: ContributeRequest) {
  return apiFetch<{ goal: Goal; contribution: Contribution }>("/api/goals/contribute", {
    method: "POST",
    body: data,
  });
}
