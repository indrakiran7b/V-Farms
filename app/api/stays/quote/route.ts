import { z } from "zod";
import { priceStayPreview } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.number().int(),
  children: z.number().int(),
  addOnIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "quote"), 40, 60_000).ok) return json({ error: "Too many requests" }, 429);
  try {
    const body = schema.parse(await request.json());
    const result = await priceStayPreview(body.checkIn, body.checkOut, {
      adults: body.adults,
      children: body.children,
    }, body.addOnIds);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
