import { getPublicBookingStatus } from "@/lib/data/store";
import { errorResponse, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token || token.length < 16) {
      return json({ error: "A valid access token is required." }, 400);
    }
    const status = getPublicBookingStatus(token);
    if (!status) return json({ error: "No booking found for this link." }, 404);
    return json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}
