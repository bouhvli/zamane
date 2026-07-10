import type { VercelRequest, VercelResponse } from "@vercel/node";

import { methodGuard } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

// A routine "am I logged in" probe — never 401, always 200 with either a
// user or null so the router's loaders can call it unconditionally.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  res.status(200).json({ user });
}
