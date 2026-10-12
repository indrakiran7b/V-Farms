import { expect, test } from "@playwright/test";

test("homepage reveals the farm video asset and whole-estate CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /private escape into nature/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /book the entire resort/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /plan an event/i }).first()).toBeVisible();
  const video = page.locator('video[src="/videos/farm-h1.mp4"]');
  await expect(video.first()).toHaveCount(1);
});

test("room profiles only offer whole-resort booking", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page.getByText("Five distinct rooms. One exclusive booking.")).toBeVisible();
  const roomCtas = page.getByRole("link", { name: /book the entire resort/i });
  await expect(roomCtas).toHaveCount(5);
  await expect(page.getByText(/book this room/i)).toHaveCount(0);
});

test("stays calendar loads live availability", async ({ page, request }) => {
  const availability = await request.get("/api/availability?from=2026-11-01&to=2026-11-07");
  expect(availability.ok()).toBeTruthy();
  const body = await availability.json();
  expect(body.dates).toHaveLength(7);
  expect(body.dates.every((day: { date: string; available: boolean }) => typeof day.available === "boolean")).toBeTruthy();
  await page.goto("/stays");
  await expect(page.getByRole("heading", { name: /your private escape awaits/i })).toBeVisible();
  await expect(page.getByText(/one exclusive booking/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /check availability/i })).toBeVisible();
  await page.getByRole("grid", { name: /stay availability calendar/i }).focus();
  await page.keyboard.press("ArrowRight");
});

test("events page shows enquiry flow without instant booking", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: /gather somewhere extraordinary/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /enquire about your event/i })).toBeVisible();
  await expect(page.getByText(/enquiry only — not a booking/i)).toBeVisible();
});

test("unauthorized admin APIs are denied", async ({ request }) => {
  const res = await request.get("/api/admin/data");
  expect(res.status()).toBe(401);
  const mutation = await request.post("/api/admin/actions", { data: { action: "payment.refund", payload: {} } });
  expect([401, 403]).toContain(mutation.status());
});
