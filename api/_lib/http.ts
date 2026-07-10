import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ZodType } from "zod";

/** Rejects the request with 405 if its method isn't in `allowed`. Returns true if handling should continue. */
export function methodGuard(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (!req.method || !allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export type ParsedBody<T> = { success: true; data: T } | { success: false; error: string };

/** Validates req.body against a zod schema, returning the first human-readable issue on failure. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): ParsedBody<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request";
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
