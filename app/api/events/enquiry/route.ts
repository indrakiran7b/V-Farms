import { z } from "zod";
import { createEventEnquiry } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";
import { enqueueNotification } from "@/lib/email/notify";
import { eventEnquiryReceiptEmail } from "@/lib/email/templates";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  organizer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(8),
  }),
  eventType: z.string().min(2),
  startDate: z.string(),
  endDate: z.string(),
  expectedAttendance: z.number().int().positive(),
  preferredTiming: z.string().optional().default(""),
  preferredStartTime: z.string().min(1),
  preferredEndTime: z.string().min(1),
  cateringNotes: z.string().optional().default(""),
  decorationNotes: z.string().optional().default(""),
  vendorNotes: z.string().optional().default(""),
  setupNotes: z.string().optional().default(""),
  accommodationRequested: z.boolean(),
  additionalNotes: z.string().optional().default(""),
  policyAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "enquiry"), 8, 60_000).ok) return json({ error: "Too many requests" }, 429);
  try {
    const body = schema.parse(await request.json());
    const enquiry = await createEventEnquiry({
      ...body,
      preferredTiming: body.preferredTiming ?? `${body.preferredStartTime} – ${body.preferredEndTime}`,
      cateringNotes: body.cateringNotes ?? "",
      decorationNotes: body.decorationNotes ?? "",
      vendorNotes: body.vendorNotes ?? "",
      setupNotes: body.setupNotes ?? "",
      additionalNotes: body.additionalNotes ?? "",
    });
    const mail = eventEnquiryReceiptEmail(enquiry.reference);
    await enqueueNotification({
      type: "enquiry_receipt",
      toEmail: enquiry.organizer.email,
      subject: mail.subject,
      body: mail.text,
      html: mail.html,
      idempotencyKey: `enquiry_receipt:${enquiry.id}`,
    });
    return json({ enquiry });
  } catch (error) {
    return errorResponse(error);
  }
}
