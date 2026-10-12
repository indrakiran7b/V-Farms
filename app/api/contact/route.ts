import { z } from "zod";
import { errorResponse, json } from "@/lib/http";
import { enqueueNotification } from "@/lib/email/notify";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
  company: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "contact"), 8, 60_000).ok) return json({ error: "Too many requests" }, 429);
  try {
    const body = schema.parse(await request.json());
    if (body.company) return json({ ok: true });
    await enqueueNotification({
      type: "contact_receipt",
      toEmail: process.env.NOTIFY_OPS_EMAIL || body.email,
      subject: `V-Farms contact from ${body.name}`,
      body: `${body.name} <${body.email}>\n\n${body.message}`,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
