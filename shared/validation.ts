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

export const contributionIdSchema = z.object({
  id: z.string().uuid("Invalid contribution id"),
});
export type ContributionIdQuery = z.infer<typeof contributionIdSchema>;

// Editing never changes a goal's type (financial ↔ general would invalidate
// its contribution history), so goalType is carried only to re-validate the
// mutable fields; the server rejects a type that doesn't match the stored row.
export const updateGoalRequestSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("financial"),
    id: z.string().uuid("Invalid goal id"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetAmount: moneyAmountSchema,
    targetDate: goalTargetDateSchema,
  }),
  z.object({
    goalType: z.literal("general"),
    id: z.string().uuid("Invalid goal id"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetDate: goalTargetDateSchema,
  }),
]);
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>;

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

// ---- Trips ----
// A trip belongs to a group, same sharing model as goals. Its itinerary is
// a flat, optionally-dated list of entries (not a nested day structure) —
// grouping by date happens client-side.

const tripTitleSchema = z.string().trim().min(1, "Title is required").max(120);
const tripDestinationSchema = z
  .string()
  .trim()
  .max(160)
  .optional()
  .or(z.literal("").transform(() => undefined));
const tripDateSchema = z
  .string()
  .date("Enter a valid date")
  .optional()
  .or(z.literal("").transform(() => undefined));
const tripBudgetSchema = z.coerce
  .number()
  .positive("Budget must be greater than 0")
  .max(MAX_MONEY_AMOUNT, "Amount is too large")
  .optional();
const tripNotesSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createTripRequestSchema = z
  .object({
    title: tripTitleSchema,
    destination: tripDestinationSchema,
    startDate: tripDateSchema,
    endDate: tripDateSchema,
    budget: tripBudgetSchema,
    notes: tripNotesSchema,
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type CreateTripRequest = z.infer<typeof createTripRequestSchema>;

export const updateTripRequestSchema = z
  .object({
    id: z.string().uuid("Invalid trip id"),
    title: tripTitleSchema,
    destination: tripDestinationSchema,
    startDate: tripDateSchema,
    endDate: tripDateSchema,
    budget: tripBudgetSchema,
    notes: tripNotesSchema,
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type UpdateTripRequest = z.infer<typeof updateTripRequestSchema>;

export const tripIdQuerySchema = z.object({
  id: z.string().uuid("Invalid trip id"),
});
export type TripIdQuery = z.infer<typeof tripIdQuerySchema>;

const itineraryTitleSchema = z.string().trim().min(1, "Title is required").max(120);
const itineraryLocationSchema = z
  .string()
  .trim()
  .max(160)
  .optional()
  .or(z.literal("").transform(() => undefined));
const itineraryNotesSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .or(z.literal("").transform(() => undefined));
const itineraryDateSchema = z
  .string()
  .date("Enter a valid date")
  .optional()
  .or(z.literal("").transform(() => undefined));
const itineraryTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createItineraryItemRequestSchema = z.object({
  tripId: z.string().uuid(),
  title: itineraryTitleSchema,
  itemDate: itineraryDateSchema,
  itemTime: itineraryTimeSchema,
  location: itineraryLocationSchema,
  notes: itineraryNotesSchema,
});
export type CreateItineraryItemRequest = z.infer<typeof createItineraryItemRequestSchema>;

export const itineraryItemIdSchema = z.object({
  id: z.string().uuid("Invalid item id"),
});
export type ItineraryItemIdQuery = z.infer<typeof itineraryItemIdSchema>;

// ---- Shopping ----
// A single shared list per group, not per-user and not multiple named
// lists — same "one shared space" model as goals and trips.

const shoppingItemNameSchema = z.string().trim().min(1, "Name is required").max(120);
const shoppingItemCategorySchema = z
  .string()
  .trim()
  .max(60)
  .optional()
  .or(z.literal("").transform(() => undefined));
const shoppingItemNotesSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));
const shoppingItemQuantitySchema = z.coerce
  .number()
  .int()
  .min(1, "Quantity must be at least 1")
  .max(9999, "Quantity is too large");
const shoppingItemPriceSchema = z.coerce
  .number()
  .nonnegative("Price can't be negative")
  .max(MAX_MONEY_AMOUNT, "Amount is too large")
  .optional();

export const createShoppingItemRequestSchema = z.object({
  name: shoppingItemNameSchema,
  quantity: shoppingItemQuantitySchema,
  category: shoppingItemCategorySchema,
  price: shoppingItemPriceSchema,
  notes: shoppingItemNotesSchema,
});
export type CreateShoppingItemRequest = z.infer<typeof createShoppingItemRequestSchema>;

export const shoppingItemIdSchema = z.object({
  id: z.string().uuid("Invalid item id"),
});
export type ShoppingItemIdQuery = z.infer<typeof shoppingItemIdSchema>;

export const toggleShoppingItemRequestSchema = z.object({
  id: z.string().uuid("Invalid item id"),
  isChecked: z.boolean(),
});
export type ToggleShoppingItemRequest = z.infer<typeof toggleShoppingItemRequestSchema>;

// ---- Profile ----

export const updateProfileRequestSchema = z.object({
  displayName: displayNameSchema,
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const changePasswordFormSchema = changePasswordRequestSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
