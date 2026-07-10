import type { VercelRequest, VercelResponse } from "@vercel/node";

import { methodGuard } from "../_lib/http";
import { deleteSessionFromRequest, clearSessionCookie } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  await deleteSessionFromRequest(req);
  clearSessionCookie(res);

  res.status(200).json({ ok: true });
}
