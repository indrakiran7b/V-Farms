import { z } from "zod";
import { authenticateAdmin, setAdminSession } from "@/lib/auth/session";
import { json } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "admin-login"), 8, 60_000).ok) {
    return json({ error: "Too many login attempts" }, 429);
  }
  const body = schema.parse(await request.json());
  const user = authenticateAdmin(body.email, body.password);
  if (!user) return json({ error: "Invalid credentials" }, 401);
  await setAdminSession(user);
  return json({ ok: true, role: user.role });
}
