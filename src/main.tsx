import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";

import { router } from "./router";
import { AuthProvider } from "./lib/auth-context";
import { ThemeColorSync } from "./components/ThemeColorSync";
import { Toaster } from "./components/ui/sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* attribute="class" matches theme.css's `.dark` custom variant —
        every dark: utility and the .dark token block were already built,
        just never reachable without this provider. defaultTheme="system"
        means no toggle UI is needed for the OS-preference case, and Profile
        offers an explicit Light/Dark/System choice on top of it. */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Keeps the status/notification bar in step with the *chosen* theme,
          which the prefers-color-scheme tags in index.html can't see. */}
      <ThemeColorSync />
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
