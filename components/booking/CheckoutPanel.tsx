"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDisplayDate, formatInr } from "@/lib/time/kolkata";
import type { StayBooking } from "@/lib/types";

type PaymentConfig = {
  onlineCheckoutEnabled: boolean;
  mode: string;
  message: string;
  configurationError?: string | null;
  setup?: {
    keyId: boolean;
    keySecret: boolean;
    webhookSecret: boolean;
    publicKeyId: boolean;
    keysMatch: boolean;
  };
};

export function CheckoutPanel({ stayId }: { stayId: string }) {
  const router = useRouter();
  const [stay, setStay] = useState<(StayBooking & { customerAccessToken?: string }) | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch(`/api/stays/${stayId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Stay not found");
        setStay(data.stay);
      })
      .catch((err: Error) => setError(err.message));
    fetch("/api/payments/config")
      .then(async (res) => res.json())
      .then((data) => setPaymentConfig(data))
      .catch(() => setPaymentConfig(null));
  }, [stayId]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "stay", sourceId: stayId }),
      });
      const data = await res.json();
      if (data.mode === "unconfigured") {
        setError(data.error ?? paymentConfig?.message ?? "Online checkout is not available.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Unable to create payment order");
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        name: "V-Farms",
        order_id: data.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verify.json();
          const token = result.token ?? stay?.customerAccessToken;
          router.push(
            `/booking/confirmation?token=${encodeURIComponent(token ?? "")}&status=${result.status ?? "pending"}`,
          );
        },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not start");
    } finally {
      setBusy(false);
    }
  }

  if (error && !stay) return <p className="text-pink-400">{error}</p>;
  if (!stay) return <p>Loading reservation…</p>;

  const online = paymentConfig?.onlineCheckoutEnabled ?? false;
  const holdActive = Boolean(stay.holdExpiresAt && new Date(stay.holdExpiresAt).getTime() > nowMs);
  const checkoutEligible = online && holdActive && (stay.status === "awaiting_payment" || stay.status === "held");

  return (
    <div className="mx-auto max-w-xl border border-earth-700/15 bg-ivory-100 p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-earth-700">{stay.reference}</p>
      <h2 className="mt-2 font-serif text-3xl">Pay to confirm the estate</h2>
      <p className="mt-4 leading-7">
        {formatDisplayDate(stay.checkIn)} → {formatDisplayDate(stay.checkOut)} · {stay.party.adults} adults, {stay.party.children} children
      </p>
      <p className="mt-2 text-sm text-muted">
        {holdActive
          ? `Hold active until ${new Date(stay.holdExpiresAt!).toLocaleString("en-IN")}.`
          : "This hold has expired. Dates may no longer be reserved — contact V-Farms to check availability."}
      </p>
      <p className="mt-6 font-serif text-4xl">{formatInr(stay.priceSnapshot.amountDueNowPaise)}</p>
      <p className="text-sm text-muted">Due now. Total {formatInr(stay.priceSnapshot.totalPaise)}.</p>

      {!online || !holdActive ? (
        <div className="mt-6 border border-earth-700/15 bg-ivory-50/80 p-4 text-sm leading-7">
          <p className="font-medium text-forest-950">
            {!online ? "Online checkout unavailable" : "Hold expired"}
          </p>
          <p className="mt-2 text-muted">
            {!online
              ? paymentConfig?.configurationError ?? paymentConfig?.message
              : "Your temporary hold has ended. Payment and confirmation require an active hold or staff assistance."}
          </p>
          <p className="mt-2">
            Reference <strong>{stay.reference}</strong>. Confirmation is issued only after verified payment and successful inventory confirmation — never from this page alone.
          </p>
          <Link href="/contact" className="mt-3 inline-block underline">
            Contact V-Farms
          </Link>
        </div>
      ) : null}

      {error && online ? <p className="mt-4 text-sm text-pink-700">{error}</p> : null}

      <button
        type="button"
        onClick={pay}
        disabled={busy || !checkoutEligible}
        className="mt-6 w-full bg-forest-900 py-3 text-xs uppercase tracking-[0.18em] text-ivory-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checkoutEligible
          ? busy
            ? "Starting checkout…"
            : "Continue to secure checkout"
          : !online
            ? "Online checkout disabled"
            : "Checkout unavailable"}
      </button>
      <p className="mt-4 text-xs leading-6 text-muted">
        A success screen is not confirmation. The booking becomes confirmed only after server-side payment verification and a valid inventory hold.
      </p>
    </div>
  );
}

function loadRazorpay(): Promise<new (options: Record<string, unknown>) => { open: () => void }> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay]");
    const done = () => {
      const ctor = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error("Razorpay checkout failed to load"));
    };
    if (existing) {
      existing.addEventListener("load", done);
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) done();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.dataset.razorpay = "true";
    script.onload = done;
    script.onerror = () => reject(new Error("Razorpay checkout failed to load"));
    document.body.appendChild(script);
  });
}
