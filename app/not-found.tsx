import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";

export default function NotFound() {
  return (
    <PublicShell darkHeader>
      <div className="bg-forest-950 px-5 pb-24 pt-36 text-ivory-50 md:px-8">
        <div className="mx-auto max-w-xl">
          <p className="text-xs uppercase tracking-[0.28em] text-gold-400">404</p>
          <h1 className="mt-4 font-serif text-5xl">This path is not on the estate</h1>
          <Link href="/" className="mt-8 inline-block border border-ivory-100/40 px-5 py-3 text-xs uppercase tracking-[0.18em]">
            Return home
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
