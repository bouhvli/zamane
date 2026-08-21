import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * The phone's status/notification bar, and the browser's toolbar, are painted
 * from `<meta name="theme-color">`.
 *
 * index.html declares two of them, switched by `prefers-color-scheme`, so the
 * very first paint is right before React has booted. But the app also lets you
 * *choose* a theme (Profile → Appearance), and a media query can't see that
 * choice: picking Dark on a phone set to light left the whole app dark with a
 * white notification bar above it.
 *
 * So once the resolved theme is known, the media-scoped tags are dropped and
 * replaced with a single unconditional one that follows the app instead of the
 * OS. Values are --background from theme.css, light and dark.
 *
 * (iOS standalone reads `apple-mobile-web-app-status-bar-style` once at
 * launch and ignores later changes, so that one stays in the HTML.)
 */
const THEME_COLOR = { light: "#F5EFF2", dark: "#0F0A0D" } as const;

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Undefined until next-themes has read storage and the media query — the
    // static tags are still the best answer until then, so leave them alone.
    if (!resolvedTheme) return;

    const color = resolvedTheme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light;

    for (const stale of document.querySelectorAll('meta[name="theme-color"][media]')) {
      stale.remove();
    }

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    if (meta.content !== color) meta.content = color;
  }, [resolvedTheme]);

  return null;
}
