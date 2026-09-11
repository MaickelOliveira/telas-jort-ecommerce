"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getVisitorId } from "@/lib/client-analytics";

export function AnalyticsHeartbeat() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const visitorId = getVisitorId();
    if (!visitorId) return;
    const send = () => fetch("/api/analytics/heartbeat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId, path: pathname }), keepalive: true,
    }).catch(() => undefined);
    send();
    const timer = window.setInterval(send, 30000);
    return () => window.clearInterval(timer);
  }, [pathname]);
  return null;
}
