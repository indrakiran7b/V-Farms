import { flushFailedNotifications } from "@/lib/email/notify";
import { json } from "@/lib/http";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }
  const retried = await flushFailedNotifications(25);
  return json({ retried });
}
