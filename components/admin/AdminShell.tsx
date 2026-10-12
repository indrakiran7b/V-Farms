"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/admin/LogoutButton";
import type { AdminRole } from "@/lib/types";
import { can, canAccessAudit } from "@/lib/auth/permissions";

const NAV: Array<{ href: string; label: string; permission?: string; ownerOnly?: boolean }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/calendar", label: "Calendar", permission: "calendar.read" },
  { href: "/admin/bookings", label: "Stays", permission: "bookings.read" },
  { href: "/admin/events", label: "Events", permission: "events.read" },
  { href: "/admin/payments", label: "Payments", permission: "payments.read" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/content", label: "Content", permission: "content.read" },
  { href: "/admin/settings", label: "Settings", ownerOnly: true },
  { href: "/admin/audit", label: "Audit", ownerOnly: true },
];

function AdminNavLinks({
  links,
  pathname,
  onNavigate,
}: {
  links: typeof NAV;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {links.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-sm px-2 py-1.5 ${active ? "bg-forest-800 text-ivory-50" : "opacity-80 hover:opacity-100"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({
  role,
  email,
  children,
}: {
  role: AdminRole;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = NAV.filter((item) => {
    if (item.ownerOnly && !canAccessAudit(role)) return false;
    if (item.permission && !can(role, item.permission) && !can(role, "*")) {
      if (item.href === "/admin/pricing" && (role === "owner" || role === "reservations")) return true;
      return false;
    }
    if (item.href === "/admin/settings" && role !== "owner") return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-ivory-50 text-forest-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-earth-700/10 bg-forest-950 p-6 text-ivory-50 md:flex">
        <p className="font-serif text-2xl">V-Farms</p>
        <p className="mt-1 truncate text-xs text-ivory-200/60">
          {email} · {role}
        </p>
        <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
          <AdminNavLinks links={links} pathname={pathname} />
        </nav>
        <LogoutButton />
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-earth-700/10 bg-ivory-50/95 px-4 py-3 backdrop-blur md:hidden">
          <p className="font-serif text-xl">Admin</p>
          <button type="button" className="text-sm uppercase tracking-wider" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
        </header>
        {open ? (
          <nav className="border-b border-earth-700/10 bg-forest-950 px-4 py-4 text-sm text-ivory-50 md:hidden">
            <AdminNavLinks links={links} pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-4">
              <LogoutButton />
            </div>
          </nav>
        ) : null}
        {children}
      </div>
    </div>
  );
}
