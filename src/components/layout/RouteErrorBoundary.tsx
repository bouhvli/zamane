import { useEffect } from "react";
import { useNavigate, useRouteError } from "react-router";
import { AlertTriangle } from "lucide-react";

import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// The one errorElement for the whole route tree (see router.tsx) — before
// this, any loader throw (a 500, a dropped connection, a session that
// expired mid-visit) crashed to React Router's unstyled default error
// screen instead of anything the app controls.
export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const isSessionExpired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (isSessionExpired) navigate("/login", { replace: true });
  }, [isSessionExpired, navigate]);

  // Redirecting away — nothing to render for the moment in between.
  if (isSessionExpired) return null;

  const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="space-y-1">
        <p className="font-display text-xl text-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button type="button" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/home")}>
          Go to Home
        </Button>
      </div>
    </div>
  );
}
