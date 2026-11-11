import { describe, expect, it } from "vitest";
import { addDays, formatVN, isDate, vietnamDay, windows } from "../src/dates";

describe("ngày tháng", () => {
  it("ngày Việt Nam lệch +7 giờ so với UTC", () => {
    expect(vietnamDay(new Date("2026-11-10T16:59:59Z"))).toBe("2026-11-10");
    expect(vietnamDay(new Date("2026-11-10T17:00:00Z"))).toBe("2026-11-11");
  });
  it("cộng ngày qua tháng và năm", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("chia khoảng không sót, không chồng", () => {
    expect(windows("2026-11-01", "2026-11-03", 1)).toHaveLength(3);
    expect(windows("2026-11-01", "2026-11-10", 7)).toEqual([
      { from: "2026-11-01", to: "2026-11-07" },
      { from: "2026-11-08", to: "2026-11-10" },
    ]);
    expect(windows("2026-11-02", "2026-11-01", 1)).toEqual([]);
  });
  it("nhận diện ngày hợp lệ", () => {
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2026-02-28")).toBe(true);
  });
  it("hiển thị giờ Việt Nam", () => {
    expect(formatVN("2026-11-11T00:15:00Z")).toBe("11/11/2026 07:15");
    expect(formatVN(null)).toBe("—");
  });
});
