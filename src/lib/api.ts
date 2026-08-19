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
  const data = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.();
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}
