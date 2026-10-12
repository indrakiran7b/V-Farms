import { z } from "zod";
import { acceptQuoteAndHold, declineQuoteByOrganizer } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  token: z.string().min(16),
  decision: z.enum(["accept", "decline"]),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "quote-response"), 12, 60_000).ok) {
    return json({ error: "Too many requests" }, 429);
  }
  try {
    const body = schema.parse(await request.json());
    if (body.decision === "decline") {
      const result = await declineQuoteByOrganizer(body.token);
      return json(result);
    }
    const result = await acceptQuoteAndHold(body.token);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
