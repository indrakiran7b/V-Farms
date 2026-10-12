import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "V-Farms — A private escape into nature",
    template: "%s · V-Farms",
  },
  description:
    "Exclusive whole-property stays and private events at a five-acre dragon fruit farm near Hyderabad, Telangana.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "V-Farms — A private escape into nature",
    description: "One exclusive five-acre estate. Five rooms. Never booked separately.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} font-sans antialiased`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
