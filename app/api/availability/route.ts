import { publicAvailability } from "@/lib/data/store";
import { json } from "@/lib/http";
import { todayInKolkata, addDays, isIsoDate } from "@/lib/time/kolkata";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "availability"), 60, 60_000);
  if (!limited.ok) return json({ error: "Too many requests" }, 429);
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? todayInKolkata();
  const to = url.searchParams.get("to") ?? addDays(from, 40);
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
    return json({ error: "Invalid date range" }, 400);
  }
  return json(publicAvailability(from, to));
}
