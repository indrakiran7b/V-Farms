import { actorFrom, requireAdmin } from "@/lib/auth/guard";
import { getStore } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { todayInKolkata } from "@/lib/time/kolkata";

export async function GET() {
  try {
    const session = await requireAdmin("calendar.read");
    void actorFrom(session);
    const store = getStore();
    const today = todayInKolkata();
    const pendingEnquiries = store.enquiries.filter((item) => item.status === "enquiry").length;
    const quotesAwaiting = store.enquiries.filter((item) => item.status === "quote_sent").length;
    const closures = store.blocks.filter((item) => item.kind === "maintenance" || item.kind === "admin").length;
    const outstanding = store.stays
      .filter((item) => item.status === "confirmed" || item.status === "awaiting_payment")
      .reduce((sum, stay) => sum + stay.priceSnapshot.balanceDuePaise, 0);

    return json({
      arrivals: store.stays.filter((item) => item.status === "confirmed" && item.checkIn === today).length,
      departures: store.stays.filter((item) => item.status === "confirmed" && item.checkOut === today).length,
      activeStays: store.stays.filter((item) => item.status === "confirmed" && item.checkIn <= today && item.checkOut > today).length,
      upcomingEvents: store.enquiries.filter((item) => item.status === "confirmed" && item.startDate >= today).length,
      pendingEnquiries,
      pendingQuotes: store.enquiries.filter((item) => item.status === "enquiry" || item.status === "review" || item.status === "quote_sent").length,
      quotesAwaiting,
      paymentExceptions: store.exceptions.filter((item) => !item.resolved).length,
      holds: store.holds.filter((item) => item.status === "active").length,
      closures,
      outstandingBalancePaise: outstanding,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
