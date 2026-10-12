import { razorpayConfigured } from "@/lib/payments/razorpay";

export type PaymentSetupStatus = {
  onlineCheckoutEnabled: boolean;
  mode: "unconfigured" | "test" | "live";
  publicMessage: string;
  checkoutKeyId: string | null;
  configurationError: string | null;
  setup: {
    keyId: boolean;
    keySecret: boolean;
    webhookSecret: boolean;
    publicKeyId: boolean;
    keysMatch: boolean;
  };
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Public Razorpay key id used by Checkout.js (never the secret). */
export function getCheckoutKeyId(): string | null {
  const serverKey = trimEnv("RAZORPAY_KEY_ID");
  const publicKey = trimEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  if (!serverKey) return publicKey || null;
  if (publicKey && publicKey !== serverKey) return null;
  return publicKey || serverKey;
}

export function getPaymentSetupStatus(): PaymentSetupStatus {
  const keyId = trimEnv("RAZORPAY_KEY_ID");
  const keySecret = trimEnv("RAZORPAY_KEY_SECRET");
  const webhookSecret = trimEnv("RAZORPAY_WEBHOOK_SECRET");
  const publicKey = trimEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  const keysMatch = !publicKey || publicKey === keyId;
  const checkoutKeyId = getCheckoutKeyId();

  let configurationError: string | null = null;
  if (keyId && publicKey && !keysMatch) {
    configurationError = "NEXT_PUBLIC_RAZORPAY_KEY_ID must match RAZORPAY_KEY_ID.";
  } else if (keyId && !keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
    configurationError = "RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_.";
  } else if ((keyId && !keySecret) || (!keyId && keySecret)) {
    configurationError = "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be set.";
  }

  const credentialsReady = Boolean(keyId && keySecret && keysMatch && checkoutKeyId);
  const onlineCheckoutEnabled = razorpayConfigured() && credentialsReady && !configurationError;

  const mode: PaymentSetupStatus["mode"] = !onlineCheckoutEnabled
    ? "unconfigured"
    : keyId.startsWith("rzp_live")
      ? "live"
      : "test";

  const publicMessage = onlineCheckoutEnabled
    ? "Secure online payment is available for eligible reservations."
    : configurationError && process.env.NODE_ENV === "development"
      ? `Online checkout is unavailable: ${configurationError}`
      : "Online card and UPI checkout is not available yet. Your hold remains active while our team confirms payment arrangements. You will receive email confirmation only after verified payment.";

  return {
    onlineCheckoutEnabled,
    mode,
    publicMessage,
    checkoutKeyId: onlineCheckoutEnabled ? checkoutKeyId : null,
    configurationError,
    setup: {
      keyId: Boolean(keyId),
      keySecret: Boolean(keySecret),
      webhookSecret: Boolean(webhookSecret),
      publicKeyId: Boolean(publicKey || keyId),
      keysMatch,
    },
  };
}

/** Customer-safe API message when order creation is blocked. */
export function unconfiguredCheckoutMessage(): string {
  return getPaymentSetupStatus().publicMessage;
}
