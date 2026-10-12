import Link from "next/link";

const COLUMNS = [
  {
    title: "Visit",
    links: [
      { href: "/stays", label: "Whole-estate stays" },
      { href: "/events", label: "Private events" },
      { href: "/rooms", label: "Five rooms" },
      { href: "/estate", label: "Explore the estate" },
    ],
  },
  {
    title: "The farm",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/experiences", label: "Experiences" },
      { href: "/gallery", label: "Gallery" },
      { href: "/faq", label: "FAQs" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cancellation-policy", label: "Cancellation" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest-950 text-ivory-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-4 md:px-8">
        <div>
          <p className="font-serif text-3xl">V-Farms</p>
          <p className="mt-4 max-w-xs text-sm leading-7 text-ivory-200/75">
            A private five-acre dragon fruit farm and exclusive retreat near Hyderabad, Telangana.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-400">{column.title}</p>
            <ul className="mt-4 space-y-2 text-sm text-ivory-200/80">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-ivory-50">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="hairline" />
      <p className="px-5 py-6 text-center text-xs text-ivory-200/50">
        © {new Date().getFullYear()} V-Farms. One exclusive property. Five rooms. Never sold separately.
      </p>
    </footer>
  );
}
