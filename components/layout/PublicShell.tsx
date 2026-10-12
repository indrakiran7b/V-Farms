import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileDock } from "@/components/layout/MobileDock";

export function PublicShell({
  children,
  darkHeader = false,
}: {
  children: React.ReactNode;
  darkHeader?: boolean;
}) {
  return (
    <>
      <SiteHeader tone={darkHeader ? "dark" : "light"} />
      <main id="main">{children}</main>
      <SiteFooter />
      <MobileDock />
    </>
  );
}
