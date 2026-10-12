"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/rooms", label: "Rooms" },
  { href: "/estate", label: "Estate" },
  { href: "/stays", label: "Stays" },
  { href: "/events", label: "Events" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const dark = tone === "dark";

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-40",
        dark ? "text-ivory-100" : "text-ink",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          V-Farms
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="opacity-80 transition hover:opacity-100">
              {link.label}
            </Link>
          ))}
          <Link
            href="/stays"
            className={cn(
              "border px-4 py-2 text-xs uppercase tracking-[0.18em]",
              dark ? "border-ivory-200/40" : "border-earth-700/40",
            )}
          >
            Book the estate
          </Link>
        </nav>
        <button
          type="button"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <div id="mobile-nav" className="border-t border-white/10 bg-forest-950/95 px-5 py-6 text-ivory-50 md:hidden">
          <nav className="flex flex-col gap-4 text-lg" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/stays" onClick={() => setOpen(false)}>
              Book the Entire Resort
            </Link>
            <Link href="/events" onClick={() => setOpen(false)}>
              Plan an Event
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
