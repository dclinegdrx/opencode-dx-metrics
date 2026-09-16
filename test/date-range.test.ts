import { describe, expect, it } from "vitest";

import { DateRangeError, dateRange } from "../src/date-range.js";

describe("dateRange", () => {
  it("creates UTC boundaries for an explicit timezone", () => {
    expect(dateRange("2026-09-16", "Etc/UTC")).toEqual({
      from: Date.parse("2026-09-16T00:00:00.000Z"),
      to: Date.parse("2026-09-17T00:00:00.000Z"),
    });
  });

  it("accounts for daylight-saving boundaries", () => {
    const spring = dateRange("2026-03-08", "America/Los_Angeles");
    const fall = dateRange("2026-11-01", "America/Los_Angeles");
    expect(spring.to - spring.from).toBe(23 * 60 * 60 * 1000);
    expect(fall.to - fall.from).toBe(25 * 60 * 60 * 1000);
  });

  it.each(["2026-9-16", "2026-02-30", "not-a-date"])(
    "rejects invalid date %s",
    (date) => {
      expect(() => dateRange(date, "Etc/UTC")).toThrow(DateRangeError);
    },
  );

  it("rejects an invalid timezone", () => {
    expect(() => dateRange("2026-09-16", "Local/Guess")).toThrow(
      /Invalid timezone/,
    );
  });
});
