"use client";

import { useEffect } from "react";

const MAX_CSS_VALUE_LENGTH = 200;

export function ThemeHotReload() {
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Verify origin matches our own
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "theme-update") return;
      const vars: Record<string, string> = e.data.cssVars ?? {};
      const root = document.documentElement;
      for (const [key, value] of Object.entries(vars)) {
        if (!key.startsWith("--")) continue;
        if (value.length > MAX_CSS_VALUE_LENGTH) continue;
        root.style.setProperty(key, value);
      }
    }

    window.addEventListener("message", handleMessage);

    // Also poll for changes from other tabs
    let lastSnapshot = "";
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch("/api/theme", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const vars: Record<string, string> = data.cssVars ?? {};
        const snapshot = JSON.stringify(vars);

        if (lastSnapshot && lastSnapshot !== snapshot) {
          const root = document.documentElement;
          for (const [key, value] of Object.entries(vars)) {
            if (!key.startsWith("--")) continue;
            if (value.length > MAX_CSS_VALUE_LENGTH) continue;
            root.style.setProperty(key, value);
          }
        }
        lastSnapshot = snapshot;
      } catch {
        // ignore
      }
    }

    poll();
    const id = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
