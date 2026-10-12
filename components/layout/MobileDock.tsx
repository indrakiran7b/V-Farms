"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileDock() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/booking") || path.startsWith("/stays")) return null;
  const event = path.startsWith("/events");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-earth-700/15 bg-ivory-50/95 px-4 py-3 backdrop-blur md:hidden">
      <Link
        href={event ? "/events" : "/stays"}
        className="block bg-forest-900 py-3 text-center text-xs uppercase tracking-[0.18em] text-ivory-50"
      >
        {event ? "Plan an Event" : "Book the Entire Resort"}
      </Link>
    </div>
  );
}
