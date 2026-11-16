import { describe, expect, it } from "vitest";
import { COURSE, featureOfPath } from "../src/course";
import { isLearnerTeam, teamCode, teamCodes, teamLabel } from "../src/domain/teams";

describe("hồ sơ khóa học", () => {
  it("NSKT2026: 12 đội, bật mọi tính năng", () => {
    expect(COURSE.id).toBe("nskt2026");
    expect(teamCodes()).toHaveLength(12);
    expect(Object.values(COURSE.features).every(Boolean)).toBe(true);
  });
  it("đọc tên đội theo hồ sơ", () => {
    expect(teamCode("🐟 Đội Cá Chép 07")).toBe("T07");
    expect(teamCode("Đội Cá Chép 13")).toBe("");
    expect(teamCode("BTC")).toBe("BTC");
    expect(isLearnerTeam("T12")).toBe(true);
    expect(isLearnerTeam("T13")).toBe(false);
    expect(teamLabel("T03")).toBe("Đội 03");
  });
  it("biết trang nào thuộc tính năng nào", () => {
    expect(featureOfPath("/cham/bai")).toBe("grading");
    expect(featureOfPath("/bao-cao/nguoi-cham")).toBe("grading");
    expect(featureOfPath("/bao-cao/buoi-hoc")).toBe("attendance");
    expect(featureOfPath("/bao-cao")).toBe("reports");
    expect(featureOfPath("/nop-bai")).toBe(null);
  });
});
