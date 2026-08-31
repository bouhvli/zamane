import { invalidateRoutes, resetRoutes } from "./route-cache";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

let unauthorizedHandler: (() => void) | null = null;

/**
 * Called once for every 401 response. `session.ts` registers itself here so a
 * session that expires mid-visit invalidates the cached session answer — the
 * callback lives here rather than the other way round to keep this module
 * dependency-free.
 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

/**
 * Thin fetch wrapper for /api/* calls: always sends the session cookie,
 * always speaks JSON, and throws a typed ApiError with the server's
 * message on any non-2xx response.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  // Anything that isn't a plain read invalidates the route store — see
  // route-cache.ts. Done here rather than at each call site so a new mutation
  // endpoint can't be added without it, and done *before* awaiting so a
  // refresh that overlaps the write is dropped rather than written back.
  //
  // Signing in or out is the one write that must *forget* rather than refresh:
  // every other mutation changes the couple's data, but this one changes whose
  // data it is, and a stale entry served across that boundary is the previous
  // account's.
  const method = (rest.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    if (path.startsWith("/api/auth/")) resetRoutes();
    else invalidateRoutes();
  }

  const response = await fetch(path, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : undefined;

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.();
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  // A 2xx that isn't JSON used to be returned as `undefined` while still typed
  // as T, and every caller believed it. That is not a hypothetical: a service
  // worker's navigation fallback, a CDN or platform error page, a captive
  // portal, or an auth redirect all answer 200 with HTML. The `undefined` then
  // travelled all the way into the route store, where seeding dereferenced it,
  // wiped the dashboard entry and threw a TypeError — so a stray HTML response
  // surfaced as "Something went wrong" with the cache left broken behind it.
  //
  // Failing here instead keeps the lie from spreading: the caller gets an
  // ApiError like any other transport failure, the store keeps the data it
  // already had, and the page carries on.
  if (!isJson) {
    throw new ApiError(
      `Expected JSON from ${path} but got ${contentType || "no content type"}`,
      response.status,
    );
  }

  return data as T;
}
