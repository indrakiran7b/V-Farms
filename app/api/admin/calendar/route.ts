import { requireAdmin } from "@/lib/auth/guard";
import { getAdminCalendarEntries } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { addDays, isIsoDate, todayInKolkata } from "@/lib/time/kolkata";

export async function GET(request: Request) {
  try {
    await requireAdmin("calendar.read");
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? todayInKolkata();
    const to = url.searchParams.get("to") ?? addDays(from, 31);
    if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
      return json({ error: "Invalid date range" }, 400);
    }
    return json({ from, to, entries: getAdminCalendarEntries(from, to) });
  } catch (error) {
    return errorResponse(error);
  }
}
