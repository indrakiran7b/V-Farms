import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

const routes = [
  "",
  "/about",
  "/rooms",
  "/estate",
  "/stays",
  "/events",
  "/experiences",
  "/gallery",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/cancellation-policy",
  "/booking",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.6,
  }));
}
