import { getPublicEventConfig } from "@/lib/data/store";
import { json } from "@/lib/http";

export async function GET() {
  return json(getPublicEventConfig());
}
