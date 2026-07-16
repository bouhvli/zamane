import { apiFetch } from "./api";
import type { SessionUser } from "./auth-context";

export function updateProfile(displayName: string | undefined) {
  return apiFetch<{ user: SessionUser }>("/api/auth/update-profile", { method: "POST", body: { displayName } });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ ok: true }>("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}
