import { setUnauthorizedHandler } from "./api";
import { fetchDashboard } from "./dashboard";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  groupId: string | null;
};

/**
 * Who is signed in — answered once per page load and shared by everyone who
 * asks.
 *
 * Three callers used to hit `/api/auth/session` on a cold launch: AuthProvider's
 * mount effect, the root loader deciding between /login and /home, and the app
 * layout's group guard after the redirect. Each one is a function invocation,
 * and whichever reaches Neon first pays the compute wake (~3s against ~50ms
 * warm). `cached` holds the resolved value for the life of the page so every
 * caller after the first is free, and `pending` de-duplicates the ones that
 * arrive while the first request is still running.
 *
 * The answer comes from `/api/home` rather than from a session endpoint of its
 * own, because that response *also* carries the group and all four tab
 * payloads. The guard and the first page's data therefore cost one request
 * between them instead of two in series — see dashboard.ts.
 *
 * Correctness: the cache is cleared whenever any API call comes back 401 (see
 * setUnauthorizedHandler below), and explicitly on login, signup and logout —
 * so a session that dies mid-visit still gets noticed on the next request,
 * which is the only moment it can actually matter.
 */
let cached: { user: SessionUser | null } | null = null;
let pending: Promise<SessionUser | null> | null = null;

export function getSessionUser(): Promise<SessionUser | null> {
  if (cached) return Promise.resolve(cached.user);
  if (!pending) {
    pending = fetchDashboard()
      .then((data) => {
        cached = { user: data.user };
        return data.user;
      })
      .catch(() => {
        // A failed bootstrap is "not signed in" for routing purposes, but it is
        // not a *known* answer — leave the cache empty so a transient network
        // blip doesn't pin the app to the logged-out state.
        return null;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Records a known-good user (from login or signup). */
export function primeSessionUser(user: SessionUser | null): void {
  cached = { user };
}

export function clearSessionUser(): void {
  cached = null;
}

// A 401 anywhere means a cached "signed in" answer is stale. It says nothing
// new when we already believe nobody is signed in, though — and that case is
// real: a signed-out visitor lands on /, gets bounced through /home, and the
// dashboard request 401s. Clearing on that would throw away the correct answer
// the session check just gave us and make the next guard fetch it all over
// again.
setUnauthorizedHandler(() => {
  if (cached?.user) clearSessionUser();
});
