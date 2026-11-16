import { describe, expect, it } from "vitest";
import { COURSE as K45 } from "../courses/45n-k2/course";
import { addMinutes, byWeek, computeDiscipline, journeyWeek, rankTeams, totals, type DisciplineInput } from "../src/discipline/engine";

// Dữ liệu giả hoàn toàn.
const cfg = K45.discipline;
const base = (): DisciplineInput => ({
  learners: [
    { id: 1, name: "Người A", team: "T01", stoppedFrom: null },
    { id: 2, name: "Người B", team: "T01", stoppedFrom: null },
    { id: 3, name: "Người C", team: "T02", stoppedFrom: null },
  ],
  assignments: [
    { id: 10, title: "Bài ngày 1", type: "NORMAL", dueAt: "2026-11-12T23:30:00" },
    { id: 11, title: "Bài tuần 1", type: "WEEK", dueAt: "2026-11-15T23:30:00" },
    { id: 12, title: "Bài ngày sắp tới", type: "NORMAL", dueAt: "2026-11-20T23:30:00" },
    { id: 9, title: "Bài khóa trước", type: "WEEK", dueAt: "2026-10-20T20:00:00" },
  ],
  subs: [
    { learnerId: 1, assignmentId: 10, status: "DONE", submittedAt: "2026-11-12T20:00:00" },
    { learnerId: 1, assignmentId: 11, status: "DONE", submittedAt: "2026-11-15T20:00:00" },
    { learnerId: 2, assignmentId: 10, status: "OVERDUE", submittedAt: "2026-11-13T08:00:00" },
    { learnerId: 2, assignmentId: 11, status: "OVERDUE", submittedAt: "2026-11-16T08:00:00" },
    { learnerId: 3, assignmentId: 10, status: "NOT_SUBMITTED", submittedAt: null },
  ],
  sessions: [{ id: 100, title: "", startAt: "2026-11-12T19:45:00", endAt: "2026-11-12T20:30:00" }],
  atts: [
    { learnerId: 1, sessionId: 100, attended: true, attendedAt: "2026-11-12T19:49:59.123" },
    { learnerId: 2, sessionId: 100, attended: true, attendedAt: "2026-11-12T19:50:01.5" },
  ],
  cameraOff: new Set(["100:1"]),
  exemptions: new Map(),
  now: "2026-11-16T12:00:00",
});

describe("kỷ luật: lỗi nhẹ / lỗi nặng", () => {
  it("tính lỗi theo phiếu yêu cầu 45N", () => {
    const [a, b, c] = computeDiscipline(base(), cfg);
    // A: đúng hạn hết, vào Zoom đúng giờ (trong 5 phút) nhưng không bật camera → 1 nặng.
    expect(a!.bai.map((x) => x.state)).toEqual(["dung-han", "dung-han", "chua-den-han"]);
    expect(a!.zoom[0]!.state).toBe("dung-gio");
    expect([a!.nhe, a!.nang, a!.points]).toEqual([0, 1, 3]);
    // B: nộp bù bài ngày (không lỗi), nộp trễ bài tuần (nặng), vào Zoom trễ (nặng).
    expect(b!.bai[0]!.faults).toEqual([]);
    expect(b!.bai[1]!.faults.map((f) => f.severity)).toEqual(["nang"]);
    expect(b!.zoom[0]!.state).toBe("tre");
    expect([b!.nhe, b!.nang]).toEqual([0, 2]);
    // C: không làm bài ngày (nhẹ), không làm bài tuần (nặng), vắng Zoom (nặng). Bài chưa tới hạn không tính.
    expect([c!.nhe, c!.nang, c!.points]).toEqual([1, 2, 7]);
    expect([c!.due, c!.onTime, c!.zoomPast, c!.zoomPresent]).toEqual([2, 0, 1, 0]);
  });

  it("BTC duyệt miễn và dừng tham gia thì không tính lỗi", () => {
    const i = base();
    i.exemptions.set("3:bai:11", "Đi công tác");
    i.exemptions.set("3:zoom:100", "Ốm");
    i.learners[1] = { ...i.learners[1]!, stoppedFrom: "2026-11-14" };
    const [, b, c] = computeDiscipline(i, cfg);
    expect(c!.bai[1]!.state).toBe("mien");
    expect(c!.bai[1]!.note).toBe("Đi công tác");
    expect([c!.nhe, c!.nang]).toEqual([1, 0]);
    expect(b!.bai[1]!.state).toBe("dung"); // hạn 15/11, đã dừng từ 14/11
    expect(b!.active).toBe(false);
    expect(b!.nang).toBe(1); // vẫn còn lỗi Zoom trễ ngày 12/11 (trước khi dừng)
  });

  it("xếp hạng nhóm theo điểm lỗi trung bình, tổng hợp theo tuần", () => {
    const rs = computeDiscipline(base(), cfg);
    const teams = rankTeams(rs);
    expect(teams.map((t) => [t.team, t.avgPoints, t.rank])).toEqual([
      ["T01", 4.5, 1],
      ["T02", 7, 2],
    ]);
    expect(teams[0]!.onTimeRate).toBe(50);
    const t = totals(rs);
    expect([t.members, t.active, t.nhe, t.nang, t.zoomRate]).toEqual([3, 3, 1, 5, 67]);
    const w = byWeek(rs, cfg);
    expect(w).toHaveLength(6);
    expect([w[0]!.due, w[0]!.onTime, w[0]!.nang, w[0]!.nhe]).toEqual([6, 2, 5, 1]);
  });

  it("tuần hành trình và cộng phút", () => {
    expect(journeyWeek(cfg, "2026-11-11T19:45:00")).toBe(1);
    expect(journeyWeek(cfg, "2026-11-17T23:30:00")).toBe(1);
    expect(journeyWeek(cfg, "2026-11-18T00:00:00")).toBe(2);
    expect(journeyWeek(cfg, "2027-02-01T00:00:00")).toBe(6);
    expect(addMinutes("2026-11-12T19:45:00", 5)).toBe("2026-11-12T19:50:00");
  });
});
