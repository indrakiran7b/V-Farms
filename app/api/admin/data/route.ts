import { requireAdmin } from "@/lib/auth/guard";
import { can, canAccessAudit } from "@/lib/auth/permissions";
import { getStore } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireAdmin();
    const store = getStore();

    if (!can(session.role, "calendar.read")) {
      if (!can(session.role, "content.read")) {
        const error = new Error("Forbidden");
        error.name = "ForbiddenError";
        throw error;
      }
      return json({
        content: store.content,
        rooms: store.rooms,
        gallery: store.gallery,
        faqs: store.faqs,
      });
    }

    return json({
      settings: store.settings,
      eventCategories: store.eventCategories,
      rooms: store.rooms,
      blocks: store.blocks,
      holds: store.holds,
      stays: store.stays,
      enquiries: store.enquiries,
      quotes: store.quotes,
      payments: store.payments,
      exceptions: store.exceptions,
      notifications: store.notifications,
      rateRules: store.rateRules,
      taxes: store.taxes,
      faqs: store.faqs,
      gallery: store.gallery,
      hotspots: store.hotspots,
      content: store.content,
      audit: canAccessAudit(session.role) ? store.audit.slice(0, 200) : [],
      refunds: canAccessAudit(session.role) ? store.refunds : [],
      session: { role: session.role, email: session.email },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
