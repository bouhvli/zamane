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

// Optional cover image for a goal. The client uploads an optimized image to
// Cloudinary via /api/goals/upload-image, which returns { url, publicId };
// those flow back in on create/update. An empty string (a cleared image)
// normalizes to undefined so "no image" and "removed image" share one shape.
const goalImageUrlSchema = z
  .string()
  .trim()
  .url("Invalid image URL")
  .max(600)
  .optional()
  .or(z.literal("").transform(() => undefined));
const goalImagePublicIdSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createGoalRequestSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("financial"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetAmount: moneyAmountSchema,
    targetDate: goalTargetDateSchema,
    imageUrl: goalImageUrlSchema,
    imagePublicId: goalImagePublicIdSchema,
  }),
  z.object({
    goalType: z.literal("general"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetDate: goalTargetDateSchema,
    imageUrl: goalImageUrlSchema,
    imagePublicId: goalImagePublicIdSchema,
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
    imageUrl: goalImageUrlSchema,
    imagePublicId: goalImagePublicIdSchema,
  }),
  z.object({
    goalType: z.literal("general"),
    id: z.string().uuid("Invalid goal id"),
    title: goalTitleSchema,
    description: goalDescriptionSchema,
    targetDate: goalTargetDateSchema,
    imageUrl: goalImageUrlSchema,
    imagePublicId: goalImagePublicIdSchema,
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

// ---- Goal notes ----
// The goal detail page is a shared "continuous note": an append-only stream
// of rich notes. A note body is an ordered list of blocks — text paragraphs
// and images (uploaded via the same Cloudinary pipeline as covers) — so a
// photo can be placed at any position between paragraphs.

export const noteTextBlockSchema = z.object({
  type: z.literal("text"),
  value: z.string().max(5000),
});
export const noteImageBlockSchema = z.object({
  type: z.literal("image"),
  url: z.string().url().max(600),
  publicId: z.string().max(300),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});
export const noteBlockSchema = z.discriminatedUnion("type", [noteTextBlockSchema, noteImageBlockSchema]);
export type NoteBlock = z.infer<typeof noteBlockSchema>;

// Up to 60 blocks per note; must carry at least one image or one non-blank
// line of text (an all-empty note is nothing to save).
export const noteBlocksSchema = z
  .array(noteBlockSchema)
  .min(1, "Write something first")
  .max(60)
  .refine(
    (blocks) => blocks.some((b) => b.type === "image" || (b.type === "text" && b.value.trim().length > 0)),
    { message: "Write something first" },
  );

export const createGoalNoteRequestSchema = z.object({
  goalId: z.string().uuid(),
  blocks: noteBlocksSchema,
});
export type CreateGoalNoteRequest = z.infer<typeof createGoalNoteRequestSchema>;

export const goalNoteIdSchema = z.object({
  id: z.string().uuid("Invalid note id"),
});
export type GoalNoteIdQuery = z.infer<typeof goalNoteIdSchema>;

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

// ---- Trip organizer ----
// An itinerary item grew from "a title on a date" into a plan entry with a
// kind, a span, a cost and an optional link back to a saved place; a trip also
// carries a board of places to visit and a shared prep checklist. The three
// share these leaf schemas so a category or a cost means the same thing
// wherever it's typed.

/** The kinds a stop or a place can be. Drives the timeline icon, the tint and
 *  the budget breakdown. Kept as a plain enum (no DB check constraint) so a
 *  new kind is a one-line change here, not a migration. */
export const tripCategorySchema = z.enum([
  "flight",
  "transport",
  "stay",
  "food",
  "sight",
  "activity",
  "other",
]);
export type TripCategory = z.infer<typeof tripCategorySchema>;

const optionalTripCategorySchema = tripCategorySchema
  .optional()
  .or(z.literal("").transform(() => undefined));

/**
 * Money as it actually arrives from a form.
 *
 * NOT `z.coerce.number()`: coerce declares its input as `number`, so every
 * caller sending the string an `<input type="number">` produced has to cast —
 * and a cast is exactly where a real mismatch would hide. It also reads an
 * untouched empty field as 0, which is a lie: 0 is a real cost, "" is a blank.
 *
 * A union input plus an explicit transform states the truth on both sides: a
 * string or a number goes in, a number or nothing comes out.
 */
const tripCostSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : Number(v)))
  .refine((n) => n === undefined || (Number.isFinite(n) && n >= 0), "Enter a cost of 0 or more")
  .refine((n) => n === undefined || n <= MAX_MONEY_AMOUNT, "Amount is too large");

const tripUrlSchema = z
  .string()
  .trim()
  .url("Enter a full link, starting with https://")
  .max(600)
  .optional()
  .or(z.literal("").transform(() => undefined));


export const createItineraryItemRequestSchema = z.object({
  tripId: z.string().uuid(),
  title: itineraryTitleSchema,
  // Every field below the title is optional on purpose: the fastest way to
  // capture "we should do X" is a name and nothing else, and a plan that
  // demands a time before it will accept an idea stops being used.
  category: optionalTripCategorySchema,
  itemDate: itineraryDateSchema,
  itemTime: itineraryTimeSchema,
  endTime: itineraryTimeSchema,
  location: itineraryLocationSchema,
  notes: itineraryNotesSchema,
  cost: tripCostSchema,
  url: tripUrlSchema,
  /** Set when the stop was scheduled straight from a saved place. */
  placeId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});
export type CreateItineraryItemRequest = z.infer<typeof createItineraryItemRequestSchema>;

export const itineraryItemIdSchema = z.object({
  id: z.string().uuid("Invalid item id"),
});
export type ItineraryItemIdQuery = z.infer<typeof itineraryItemIdSchema>;

export const updateItineraryItemRequestSchema = z.object({
  id: z.string().uuid("Invalid item id"),
  title: itineraryTitleSchema,
  category: optionalTripCategorySchema,
  itemDate: itineraryDateSchema,
  itemTime: itineraryTimeSchema,
  endTime: itineraryTimeSchema,
  location: itineraryLocationSchema,
  notes: itineraryNotesSchema,
  cost: tripCostSchema,
  url: tripUrlSchema,
  placeId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});
export type UpdateItineraryItemRequest = z.infer<typeof updateItineraryItemRequestSchema>;

/** Ticking a stop off as the trip happens. Split from the full update so a
 *  one-tap toggle doesn't have to round-trip every other field (and can't
 *  clobber an edit made on the other phone in between). */
export const setItineraryItemDoneRequestSchema = z.object({
  id: z.string().uuid("Invalid item id"),
  isDone: z.boolean(),
});
export type SetItineraryItemDoneRequest = z.infer<typeof setItineraryItemDoneRequestSchema>;

// ---- Places ----

const placeNameSchema = z.string().trim().min(1, "Give the place a name").max(120);
const placeAreaSchema = z
  .string()
  .trim()
  .max(160)
  .optional()
  .or(z.literal("").transform(() => undefined));
const placeNotesSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createTripPlaceRequestSchema = z.object({
  tripId: z.string().uuid(),
  name: placeNameSchema,
  category: optionalTripCategorySchema,
  area: placeAreaSchema,
  notes: placeNotesSchema,
  url: tripUrlSchema,
  estCost: tripCostSchema,
  isPriority: z.boolean().optional(),
});
export type CreateTripPlaceRequest = z.infer<typeof createTripPlaceRequestSchema>;

export const updateTripPlaceRequestSchema = createTripPlaceRequestSchema
  .omit({ tripId: true })
  .extend({ id: z.string().uuid("Invalid place id") });
export type UpdateTripPlaceRequest = z.infer<typeof updateTripPlaceRequestSchema>;

/** Marking a place seen — the same one-tap-toggle rationale as
 *  setItineraryItemDoneRequestSchema. */
export const setTripPlaceVisitedRequestSchema = z.object({
  id: z.string().uuid("Invalid place id"),
  isVisited: z.boolean(),
});
export type SetTripPlaceVisitedRequest = z.infer<typeof setTripPlaceVisitedRequestSchema>;

export const tripPlaceIdSchema = z.object({
  id: z.string().uuid("Invalid place id"),
});
export type TripPlaceIdQuery = z.infer<typeof tripPlaceIdSchema>;

// ---- Prep checklist ----

/** Buckets rather than free text: two people typing their own category names
 *  produces a list that groups into nothing. */
export const checklistCategorySchema = z.enum(["packing", "documents", "bookings", "todo"]);
export type ChecklistCategory = z.infer<typeof checklistCategorySchema>;

export const createChecklistItemRequestSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().trim().min(1, "Write what needs doing").max(160),
  category: checklistCategorySchema.optional().or(z.literal("").transform(() => undefined)),
});
export type CreateChecklistItemRequest = z.infer<typeof createChecklistItemRequestSchema>;

export const setChecklistItemDoneRequestSchema = z.object({
  id: z.string().uuid("Invalid item id"),
  isDone: z.boolean(),
});
export type SetChecklistItemDoneRequest = z.infer<typeof setChecklistItemDoneRequestSchema>;

export const checklistItemIdSchema = z.object({
  id: z.string().uuid("Invalid item id"),
});
export type ChecklistItemIdQuery = z.infer<typeof checklistItemIdSchema>;

// ---- Request INPUT types ----
// `z.infer` is the OUTPUT of a schema: what a handler holds after parsing, with
// every `coerce` and `transform` already applied. A client sends the INPUT —
// a cost is still the string an <input type="number"> produced, and a cleared
// select is still "". Typing the fetch wrappers with the output type made every
// call site cast, which is exactly the place a real mismatch would hide.
export type CreateItineraryItemInput = z.input<typeof createItineraryItemRequestSchema>;
export type UpdateItineraryItemInput = z.input<typeof updateItineraryItemRequestSchema>;
export type CreateTripPlaceInput = z.input<typeof createTripPlaceRequestSchema>;
export type UpdateTripPlaceInput = z.input<typeof updateTripPlaceRequestSchema>;
export type CreateChecklistItemInput = z.input<typeof createChecklistItemRequestSchema>;

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
