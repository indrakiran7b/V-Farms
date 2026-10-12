import { afterEach, describe, expect, it } from "vitest";
import { getCheckoutKeyId, getPaymentSetupStatus } from "@/lib/payments/config";

const TEST_KEY = "rzp_test_Tmwxp5lWWcmIZj";

afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

describe("Razorpay configuration", () => {
  it("disables checkout when credentials are missing", () => {
    const status = getPaymentSetupStatus();
    expect(status.onlineCheckoutEnabled).toBe(false);
    expect(status.setup.keyId).toBe(false);
    expect(status.setup.keySecret).toBe(false);
  });

  it("enables checkout when server key and secret are set", () => {
    process.env.RAZORPAY_KEY_ID = TEST_KEY;
    process.env.RAZORPAY_KEY_SECRET = "test_secret_value";
    const status = getPaymentSetupStatus();
    expect(status.onlineCheckoutEnabled).toBe(true);
    expect(status.mode).toBe("test");
    expect(status.checkoutKeyId).toBe(TEST_KEY);
    expect(getCheckoutKeyId()).toBe(TEST_KEY);
  });

  it("disables checkout when public and server key ids mismatch", () => {
    process.env.RAZORPAY_KEY_ID = TEST_KEY;
    process.env.RAZORPAY_KEY_SECRET = "test_secret_value";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_other_key";
    const status = getPaymentSetupStatus();
    expect(status.onlineCheckoutEnabled).toBe(false);
    expect(status.setup.keysMatch).toBe(false);
    expect(status.configurationError).toMatch(/must match/i);
  });

  it("does not require webhook secret to enable checkout", () => {
    process.env.RAZORPAY_KEY_ID = TEST_KEY;
    process.env.RAZORPAY_KEY_SECRET = "test_secret_value";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = TEST_KEY;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(getPaymentSetupStatus().onlineCheckoutEnabled).toBe(true);
    expect(getPaymentSetupStatus().setup.webhookSecret).toBe(false);
  });
});
