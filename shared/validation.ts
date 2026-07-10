import { z } from "zod";

// Shared between the React forms (via @hookform/resolvers/zod) and the
// /api serverless functions (server-side re-validation) — never trust
// client-side validation alone for anything security-relevant.

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Must be at least 8 characters")
  .regex(/[A-Za-z]/, "Must include at least one letter")
  .regex(/[0-9]/, "Must include at least one number");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .optional()
  .or(z.literal("").transform(() => undefined));

// ---- Signup ----

export const signupRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const signupFormSchema = signupRequestSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SignupFormValues = z.infer<typeof signupFormSchema>;

// ---- Login ----

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// ---- Forgot password ----

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

// ---- Reset password ----

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, "Missing reset token"),
  newPassword: passwordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const resetPasswordFormSchema = resetPasswordRequestSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

// ---- Groups ----

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(6, "Invite code must be 6 characters");

export const joinGroupRequestSchema = z.object({ inviteCode: inviteCodeSchema });
export type JoinGroupRequest = z.infer<typeof joinGroupRequestSchema>;

// ---- Goals ----
// Goals are shared within a group (a couple's pair), not by every
// registered user of the app instance. Financial goals track progress via
// a target amount; general goals track progress via a 0-100 percentage.
// Both shapes end up with a progress bar + a contribution history, just
// measured differently.

export const goalTypeSchema = z.enum(["financial", "general"]);

const goalTitleSchema = z.string().trim().min(1, "Title is required").max(120);
const goalDescriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal("").transform(() => undefined));
const goalTargetDateSchema = z
  .string()
  .date("Enter a valid date")
  .optional()
  .or(z.literal("").transform(() => undefined));
const contributionNoteSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));

// Matches the db schema's `numeric(12,2)` column ceiling — validated here
// so an unrealistic amount surfaces as an inline form error instead of a
// database-level failure on submit.
export const MAX_MONEY_AMOUNT = 9_999_999_999.99;
const moneyAmountSchema = z.coerce
  .number()
  .positive("Amount must be greater than 0")
  .max(MAX_MONEY_AMOUNT, "Amount is too large");

export const createGoalRequestSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("financial"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetAmount: moneyAmountSchema,
    targetDate: goalTargetDateSchema,
  }),
  z.object({
    goalType: z.literal("general"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetDate: goalTargetDateSchema,
  }),
]);
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>;

export const goalIdQuerySchema = z.object({
  id: z.string().uuid("Invalid goal id"),
});
export type GoalIdQuery = z.infer<typeof goalIdQuerySchema>;

export const contributeRequestSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("financial"),
    goalId: z.string().uuid(),
    amount: moneyAmountSchema,
    note: contributionNoteSchema,
  }),
  z.object({
    goalType: z.literal("general"),
    goalId: z.string().uuid(),
    newProgressPct: z.coerce.number().int().min(0).max(100),
    note: contributionNoteSchema,
  }),
]);
export type ContributeRequest = z.infer<typeof contributeRequestSchema>;
