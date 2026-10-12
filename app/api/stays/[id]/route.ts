import { getStore } from "@/lib/data/store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const stay = getStore().stays.find((item) => item.id === id);
  if (!stay) return json({ error: "Stay not found" }, 404);
  return json({
    stay: {
      id: stay.id,
      reference: stay.reference,
      customerAccessToken: stay.customerAccessToken,
      status: stay.status,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      party: stay.party,
      holdExpiresAt: stay.holdExpiresAt,
      priceSnapshot: stay.priceSnapshot,
      guest: { name: stay.guest.name },
    },
  });
}
