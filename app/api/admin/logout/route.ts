import { clearAdminSession } from "@/lib/auth/session";
import { json } from "@/lib/http";

export async function POST() {
  await clearAdminSession();
  return json({ ok: true });
}
