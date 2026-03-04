"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function trackEvent(event: string, path: string, metadata?: Record<string, unknown>) {
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, path, metadata }),
  }).catch(() => {});
}

export { trackEvent };

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("pageview", pathname);

    const productMatch = pathname.match(/^\/products\/(.+)$/);
    if (productMatch) {
      trackEvent("product_view", pathname, { slug: productMatch[1] });
    }
  }, [pathname]);

  return null;
}
