import { Resend } from "resend";
import { randomId } from "@/lib/crypto";
import { withInventory } from "@/lib/data/store";
import type { NotificationRecord } from "@/lib/types";

const MAX_ATTEMPTS = 5;

function resendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function fromAddress(): string | null {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || null;
}

export async function enqueueNotification(input: {
  type: NotificationRecord["type"];
  toEmail: string;
  subject: string;
  body: string;
  html?: string | null;
  idempotencyKey?: string | null;
}): Promise<NotificationRecord> {
  const duplicate = await withInventory((store) => {
    if (!input.idempotencyKey) return null;
    return store.notifications.find(
      (item) => item.idempotencyKey === input.idempotencyKey && item.status === "sent",
    );
  });
  if (duplicate) return duplicate;

  const record: NotificationRecord = {
    id: randomId("mail"),
    type: input.type,
    toEmail: input.toEmail,
    subject: input.subject,
    body: input.body,
    html: input.html ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    status: "queued",
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    sentAt: null,
  };
  await withInventory((store) => {
    store.notifications.unshift(record);
  });
  return deliverNotification(record.id);
}

export async function deliverNotification(id: string): Promise<NotificationRecord> {
  return withInventory(async (store) => {
    const record = store.notifications.find((item) => item.id === id);
    if (!record) throw new Error("Notification not found");
    if (record.status === "sent") return record;
    if (record.attempts >= MAX_ATTEMPTS) {
      record.status = "failed";
      record.lastError = "Maximum delivery attempts reached.";
      return record;
    }
    record.attempts += 1;
    const client = resendClient();
    const from = fromAddress();
    if (!client || !from) {
      record.status = "failed";
      record.lastError = "Email provider is not configured. Message retained for retry.";
      return record;
    }
    try {
      const result = await client.emails.send({
        from,
        to: record.toEmail,
        subject: record.subject,
        text: record.body,
        html: record.html ?? undefined,
      });
      if (result.error) {
        record.status = "failed";
        record.lastError = result.error.message;
        return record;
      }
      record.status = "sent";
      record.sentAt = new Date().toISOString();
      record.lastError = null;
      return record;
    } catch (error) {
      record.status = "failed";
      record.lastError = error instanceof Error ? error.message : "Email send failed";
      return record;
    }
  });
}

export async function flushFailedNotifications(limit = 10): Promise<number> {
  const { listRetryableNotifications } = await import("@/lib/data/store");
  const pending = listRetryableNotifications(limit);
  for (const item of pending) {
    await deliverNotification(item.id);
  }
  return pending.length;
}

/** @deprecated Use stayConfirmedEmail template via enqueueNotification */
export function bookingEmail(reference: string, dates: string, total: string): { subject: string; body: string } {
  return {
    subject: `V-Farms booking ${reference}`,
    body: [
      "Thank you for reserving the entire V-Farms estate.",
      `Reference: ${reference}`,
      `Dates: ${dates}`,
      `Amount recorded: ${total}`,
      "A reservation is confirmed only after verified payment and a valid inventory claim.",
    ].join("\n"),
  };
}
