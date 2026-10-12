import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createDevSeed } from "@/lib/data/seed";

describe("room profiles remain informational", () => {
  it("has five placeholder rooms and no room-level inventory", () => {
    const rooms = createDevSeed().rooms;
    expect(rooms).toHaveLength(5);
    expect(rooms.every((room) => room.awaitingOwnerApproval)).toBe(true);
  });

  it("room page CTAs go to whole-resort booking only", () => {
    const source = readFileSync(path.join(process.cwd(), "app/rooms/page.tsx"), "utf8");
    expect(source).toContain("Book the Entire Resort");
    expect(source).toContain('href="/booking"');
    expect(source).not.toMatch(/Book this room/i);
    expect(source).not.toMatch(/room availability/i);
  });
});
