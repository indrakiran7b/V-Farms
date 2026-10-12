import type { AppStore } from "@/lib/types";

export type AdminData = Pick<
  AppStore,
  | "settings"
  | "eventCategories"
  | "rooms"
  | "blocks"
  | "holds"
  | "stays"
  | "enquiries"
  | "quotes"
  | "payments"
  | "exceptions"
  | "notifications"
  | "rateRules"
  | "taxes"
  | "faqs"
  | "gallery"
  | "hotspots"
  | "content"
  | "audit"
  | "refunds"
> & {
  session?: { role: string; email: string };
};
