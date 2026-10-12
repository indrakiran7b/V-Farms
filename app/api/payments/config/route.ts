import { getPaymentSetupStatus } from "@/lib/payments/config";
import { json } from "@/lib/http";

export async function GET() {
  const status = getPaymentSetupStatus();
  const body: Record<string, unknown> = {
    onlineCheckoutEnabled: status.onlineCheckoutEnabled,
    mode: status.mode,
    message: status.publicMessage,
    checkoutKeyId: status.checkoutKeyId,
  };
  if (process.env.NODE_ENV === "development") {
    body.setup = status.setup;
    body.configurationError = status.configurationError;
  }
  return json(body);
}
