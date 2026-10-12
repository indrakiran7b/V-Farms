import { describe, expect, it } from "vitest";
import { isInRange, monthMatrix, selectStayDate, shiftMonth } from "@/lib/booking/calendar-utils";

describe("booking calendar helpers", () => {
  it("builds a month grid padded to full weeks", () => {
    const cells = monthMatrix(2026, 2);
    expect(cells.length % 7).toBe(0);
    expect(cells.some((cell) => cell === null)).toBe(true);
    expect(cells.includes("2026-03-15")).toBe(true);
  });

  it("selects check-in then check-out", () => {
    const open = (d: string) => d >= "2026-11-01";
    expect(selectStayDate({ checkIn: null, checkOut: null }, "2026-11-06", open)).toEqual({
      checkIn: "2026-11-06",
      checkOut: null,
    });
    expect(
      selectStayDate({ checkIn: "2026-11-06", checkOut: null }, "2026-11-09", open),
    ).toEqual({ checkIn: "2026-11-06", checkOut: "2026-11-09" });
  });

  it("restarts selection when choosing an earlier date", () => {
    const open = () => true;
    expect(
      selectStayDate({ checkIn: "2026-11-06", checkOut: "2026-11-09" }, "2026-11-03", open),
    ).toEqual({ checkIn: "2026-11-03", checkOut: null });
  });

  it("highlights nights strictly between check-in and check-out", () => {
    expect(isInRange("2026-11-07", "2026-11-06", "2026-11-09")).toBe(true);
    expect(isInRange("2026-11-06", "2026-11-06", "2026-11-09")).toBe(false);
    expect(isInRange("2026-11-09", "2026-11-06", "2026-11-09")).toBe(false);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });
});
