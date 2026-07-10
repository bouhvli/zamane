import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";

import { router } from "./router";
import { AuthProvider } from "./lib/auth-context";
import { Toaster } from "./components/ui/sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* attribute="class" matches theme.css's `.dark` custom variant —
        every dark: utility and the .dark token block were already built,
        just never reachable without this provider. defaultTheme="system"
        means no toggle UI is needed for the OS-preference case; index.html's
        <meta name="theme-color"> already branches on prefers-color-scheme,
        so the status bar and the app content now agree. */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
