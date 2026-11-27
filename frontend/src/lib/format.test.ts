import { describe, expect, test } from "vitest";
import { formatDate, formatDateTime, percent, plural, relativeDay, usd, usdShort } from "./format";

describe("money (G8)", () => {
  test("usd shows the full amount with the currency", () => {
    expect(usd(12400)).toBe("US$12,400");
    expect(usd(0)).toBe("US$0");
    expect(usd(1234567)).toBe("US$1,234,567");
  });

  test("usdShort shortens to k and M", () => {
    expect(usdShort(48000)).toBe("US$48k");
    expect(usdShort(41500)).toBe("US$41.5k");
    expect(usdShort(1200000)).toBe("US$1.2M");
    expect(usdShort(999)).toBe("US$999");
    expect(usdShort(1000)).toBe("US$1k");
    expect(usdShort(999_999)).toBe("US$1M");
  });
});

test("percent", () => {
  expect(percent(75)).toBe("75%");
});

describe("dates", () => {
  test("formatDate and formatDateTime", () => {
    expect(formatDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatDate("2026-03-12T23:30:00")).toBe("12 Mar 2026");
    expect(formatDateTime("2026-03-12T14:30:00")).toBe("12 Mar 2026, 14:30");
  });

  test("relativeDay uses the given today", () => {
    expect(relativeDay("2026-11-26T09:00:00", "2026-11-26")).toBe("Today");
    expect(relativeDay("2026-11-25", "2026-11-26")).toBe("Yesterday");
    expect(relativeDay("2026-11-24", "2026-11-26")).toBe("24 Nov 2026");
    expect(relativeDay("2026-02-28", "2026-03-01")).toBe("Yesterday");
  });
});

test("plural", () => {
  expect(plural(1, "deal")).toBe("1 deal");
  expect(plural(2, "deal")).toBe("2 deals");
  expect(plural(0, "activity")).toBe("0 activities");
  expect(plural(1, "activity")).toBe("1 activity");
});
