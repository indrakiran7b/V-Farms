import { formatInr } from "@/lib/time/kolkata";

const BRAND = "V-Farms";

function layout(title: string, lines: string[]): { subject: string; text: string; html: string } {
  const text = [title, "", ...lines, "", "—", BRAND, "Exclusive whole-property stays & private events · Hyderabad"].join("\n");
  const bodyHtml = lines.map((line) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1a2e1a;">${escapeHtml(line)}</p>`).join("");
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f7f4ee;font-family:Georgia,serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#3d5a3d;margin:0 0 8px;">${BRAND}</p>
  <h1 style="font-size:26px;font-weight:400;color:#0f2418;margin:0 0 24px;">${escapeHtml(title)}</h1>
  ${bodyHtml}
</div></body></html>`;
  return { subject: `${BRAND} — ${title}`, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function stayPaymentRequestEmail(input: {
  reference: string;
  dates: string;
  amountDuePaise: number;
  holdExpiresAt: string;
}): { subject: string; text: string; html: string } {
  return layout("Complete your estate reservation", [
    `Reference ${input.reference}`,
    `Dates: ${input.dates}`,
    `Amount due now: ${formatInr(input.amountDuePaise)}`,
    `Your hold is active until ${new Date(input.holdExpiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
    "This message is not a confirmation. The booking is confirmed only after verified payment and a valid inventory hold.",
  ]);
}

export function stayConfirmedEmail(input: {
  reference: string;
  dates: string;
  paidPaise: number;
  balancePaise: number;
  policySummary: string;
}): { subject: string; text: string; html: string } {
  return layout("Your V-Farms stay is confirmed", [
    `Reference ${input.reference}`,
    `Dates: ${input.dates}`,
    `Payment recorded: ${formatInr(input.paidPaise)}`,
    input.balancePaise > 0 ? `Outstanding balance: ${formatInr(input.balancePaise)}` : "No further balance is due at this stage.",
    input.policySummary,
    "We look forward to welcoming you to the entire estate.",
  ]);
}

export function eventEnquiryReceiptEmail(reference: string): { subject: string; text: string; html: string } {
  return layout("Event enquiry received", [
    `Reference ${reference}`,
    "Your enquiry does not reserve the estate.",
    "Our team will review dates and requirements. You will receive a secure quotation link if the property can be considered.",
  ]);
}

export function eventConfirmedEmail(input: {
  reference: string;
  dates: string;
  depositPaise: number;
}): { subject: string; text: string; html: string } {
  return layout("Event deposit confirmed", [
    `Reference ${input.reference}`,
    `Event dates: ${input.dates}`,
    `Deposit recorded: ${formatInr(input.depositPaise)}`,
    "Your event is confirmed on the property calendar after verified deposit payment.",
  ]);
}

export function paymentFailedEmail(reference: string): { subject: string; text: string; html: string } {
  return layout("Payment could not be completed", [
    `Reference ${reference}`,
    "We did not receive a verified successful payment.",
    "If funds were debited, they will follow your bank's reversal timeline. You may restart checkout from your reservation link or contact V-Farms with your payment id.",
  ]);
}

export function refundUpdateEmail(input: {
  reference: string;
  amountPaise: number;
  status: string;
}): { subject: string; text: string; html: string } {
  return layout("Refund update", [
    `Reference ${input.reference}`,
    `Refund amount: ${formatInr(input.amountPaise)}`,
    `Status: ${input.status}`,
  ]);
}
