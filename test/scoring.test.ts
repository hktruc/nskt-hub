import { describe, expect, it } from "vitest";
import { colorOf } from "../src/scoring/config";
import { rank, weight, type ScoreRow } from "../src/scoring/leaderboard";
import { aiTasks, looksNonsense, scoreSubmission } from "../src/scoring/rules";
import { buildDailySpec, buildWeeklySpec, labelPoints, specMax } from "../src/scoring/spec";

const DAILY_Q = [
  "BTVN/ngày (bắt buộc) (X1)  01 việc tốt hôm nay bạn làm là gì?",
  "BTVN/ngày (bắt buộc) (X1)  Thực tập đọc lời hứa thế nào?",
  "BTVN/ngày (bắt buộc) (X1)  Bạn thực tập lắng nghe sâu thế nào?",
  "BTVN/ngày (khuyến khích) (X3)  - Kể 1 tích chuyện nhỏ - Quay video, đăng youtube",
];
const ans = (...a: (string | null)[]) => a.map((answer, i) => ({ question: DAILY_Q[i] ?? `Câu ${i}`, type: "Tự luận", answer }));
const DUE = "2026-11-07T23:00:00";

describe("cấu trúc câu hỏi", () => {
  it("bài ngày đọc nhãn X1 / X3 trong đề: tối đa 6 điểm", () => {
    expect(labelPoints(DAILY_Q[3]!)).toBe(3);
    const spec = buildDailySpec(DAILY_Q);
    expect(spec.questions.map((q) => q.kind)).toEqual(["bat-buoc", "bat-buoc", "bat-buoc", "khuyen-khich"]);
    expect(specMax(spec)).toBe(6);
  });

  it("bài tuần: câu góp ý 1 điểm, câu đa số nộp video tính theo số video, còn lại 3 điểm", () => {
    const qs = [
      "Làm tất cả câu chuyện trên lớp: link 4 câu chuyện",
      "Viết Nhật ký đúc kết của bạn từ trải nghiệm khen chê của đồng đội về video của bạn?",
      "Đúc kết công thức kể chuyện hay (nộp ảnh)",
      "01 điểm tốt cần phát huy trong lớp học là gì?",
      "Bạn có khó khăn & câu hỏi gì đến BTC/Thầy?",
    ];
    const sub = (videos: number) => [
      { question: qs[0]!, type: "Tự luận", answer: Array.from({ length: videos }, (_, i) => `https://youtu.be/v${i}`).join(" ") },
      { question: qs[1]!, type: "Tự luận", answer: "Em thấy vui khi được góp ý" },
      { question: qs[2]!, type: "Tự luận", answer: "https://s3.sunteco.app/i/a.jpg" },
      { question: qs[3]!, type: "Tự luận", answer: "Thầy nhiệt tình" },
      { question: qs[4]!, type: "Tự luận", answer: "" },
    ];
    const spec = buildWeeklySpec(qs, [sub(4), sub(4), sub(4), sub(2), sub(0)]);
    expect(spec.questions.map((q) => [q.kind, q.max])).toEqual([
      ["video", 40],
      ["bat-buoc", 3],
      ["bat-buoc", 3],
      ["gop-y", 1],
      ["gop-y", 1],
    ]);
    expect(spec.questions[0]!.expectedVideos).toBe(4);
    expect(spec.questions[2]!.wantsImage).toBe(true);
  });
});

describe("chấm một bài nộp", () => {
  const daily = buildDailySpec(DAILY_Q);

  it("bài ngày đúng hạn có video: 1+1+1+3", () => {
    const s = scoreSubmission({ spec: daily, answers: ans("a", "b", "c", "https://youtu.be/x"), status: "DONE", submittedAt: "2026-11-07T20:00:00", dueAt: DUE });
    expect([s.earned, s.max, s.onTimeVideos, s.hoursEarly, s.provisional]).toEqual([6, 6, 1, 3, false]);
  });

  it("nộp trễ: video được 2 điểm, câu chữ được một nửa", () => {
    const s = scoreSubmission({ spec: daily, answers: ans("a", "b", "c", "https://fb.watch/x"), status: "OVERDUE", submittedAt: "2026-11-08T08:00:00", dueAt: DUE });
    expect([s.earned, s.max, s.onTimeVideos, s.hoursEarly]).toEqual([1.5 + 2, 6, 0, null]);
  });

  it("bài tuần nộp trễ: AI vẫn kiểm tra nội dung, đạt thì được nửa điểm", () => {
    const qs = ["Làm câu chuyện", "Viết nhật ký đúc kết?", "01 điểm tốt cần phát huy trong lớp học là gì?"];
    const spec = buildWeeklySpec(qs, [[{ question: qs[0]!, type: "Tự luận", answer: "https://youtu.be/a" }]]);
    const answers = [
      { question: qs[0]!, type: "Tự luận", answer: "https://youtu.be/a" },
      { question: qs[1]!, type: "Tự luận", answer: "Em học được cách lắng nghe đồng đội" },
      { question: qs[2]!, type: "Tự luận", answer: "Thầy rất tận tâm" },
    ];
    expect(aiTasks(spec, answers).map((t) => t.index)).toEqual([1, 2]);
    const s = scoreSubmission({
      spec, answers, status: "OVERDUE", submittedAt: "2026-11-07T10:00:00", dueAt: "2026-11-06T23:00:00",
      ai: [{ index: 1, ok: true, nonsense: false }, { index: 2, ok: false, nonsense: true }],
    });
    expect([s.earned, s.max]).toEqual([2 + 1.5 + 0, 10 + 3 + 1]);
  });

  it("câu khuyến khích bằng chữ: AI nói sâu sắc thì 1 điểm; chưa có AI thì tạm theo độ dài", () => {
    const deep = "Hôm nay em nhận ra lắng nghe sâu giúp em hiểu mẹ hơn, em sẽ tập dừng lại trước khi trả lời mỗi ngày.";
    const answers = ans("a", "b", "c", deep);
    expect(aiTasks(daily, answers)).toEqual([{ index: 3, task: "sau-sac", question: DAILY_Q[3], answer: deep }]);
    const tam = scoreSubmission({ spec: daily, answers, status: "DONE", submittedAt: null, dueAt: DUE });
    expect([tam.earned, tam.provisional]).toEqual([4, true]);
    const byAi = scoreSubmission({ spec: daily, answers, status: "DONE", submittedAt: null, dueAt: DUE, ai: [{ index: 3, ok: false, nonsense: false }] });
    expect([byAi.earned, byAi.provisional]).toEqual([3, false]);
  });

  it("chưa nộp: 0 trên tối đa", () => {
    const s = scoreSubmission({ spec: daily, answers: [], status: "NOT_SUBMITTED", submittedAt: null, dueAt: DUE });
    expect([s.earned, s.max]).toEqual([0, 6]);
  });

  it("bài tuần: mỗi video 10 điểm (tối đa theo đề), nộp ảnh là đạt, AI đánh dấu đối phó", () => {
    const qs = ["Làm câu chuyện", "Viết nhật ký đúc kết?", "Đúc kết công thức (nộp ảnh)", "01 điểm tốt cần phát huy trong lớp học là gì?"];
    const spec = buildWeeklySpec(qs, [[{ question: qs[0]!, type: "Tự luận", answer: "https://youtu.be/a https://youtu.be/b" }]]);
    const answers = [
      { question: qs[0]!, type: "Tự luận", answer: "https://youtu.be/a https://youtu.be/b https://youtu.be/c" },
      { question: qs[1]!, type: "Tự luận", answer: "asdf" },
      { question: qs[2]!, type: "Tự luận", answer: "https://s3.sunteco.app/i/a.jpg" },
      { question: qs[3]!, type: "Tự luận", answer: "Buổi offline rất vui" },
    ];
    expect(aiTasks(spec, answers).map((t) => t.index)).toEqual([1, 3]);
    const s = scoreSubmission({
      spec, answers, status: "DONE", submittedAt: "2026-11-05T23:00:00", dueAt: "2026-11-06T23:00:00",
      ai: [{ index: 1, ok: false, nonsense: true, note: "gõ đại" }, { index: 3, ok: true, nonsense: false }],
    });
    expect([s.earned, s.max, s.onTimeVideos, s.hoursEarly]).toEqual([20 + 0 + 3 + 1, 20 + 3 + 3 + 1, 2, 24]);
    expect(s.flags).toEqual([{ index: 1, reason: "gõ đại" }]);
  });
});

describe("nhận biết trả lời đối phó bằng quy tắc", () => {
  it("bắt ký hiệu, chữ lặp, quá ngắn, gõ đại; để yên câu bình thường", () => {
    expect(looksNonsense("...")).toBe("chỉ có ký hiệu, không có chữ");
    expect(looksNonsense("aaaaaaaa")).toBe("lặp ký tự");
    expect(looksNonsense("ok")).toBe("quá ngắn");
    expect(looksNonsense("xdfg hjkl qwrt")).toBe("gõ đại, không thành từ");
    expect(looksNonsense("Em đã giúp mẹ nấu cơm")).toBeNull();
    expect(looksNonsense("")).toBeNull();
  });
});

describe("bảng xếp hạng", () => {
  it("điểm cũ mờ dần: 3 tuần trước tính một nửa", () => {
    expect(weight("2026-11-10", "2026-11-11")).toBe(1);
    expect(weight("2026-10-21", "2026-11-11")).toBeCloseTo(0.5);
    expect(weight("2026-09-30", "2026-11-11")).toBeCloseTo(0.25);
  });

  it("màu theo ngưỡng 80 / 50", () => {
    expect([colorOf(80), colorOf(79.9), colorOf(50), colorOf(49.9)]).toEqual(["xanh", "vang", "vang", "do"]);
  });

  it("người cố gắng về sau vượt người chỉ làm tốt lúc đầu", () => {
    const row = (id: number, due: string, earned: number): ScoreRow => ({
      learner_id: id, full_name: `HV ${id}`, team_name: "🐟 Đội Cá Chép 01", due_at: due, earned, max: 10, on_time_videos: 0, hours_early: null, provisional: 0,
    });
    const rows = [row(1, "2026-10-01", 10), row(1, "2026-11-10", 0), row(2, "2026-10-01", 0), row(2, "2026-11-10", 10)];
    const { ranked } = rank(rows, "2026-11-11");
    expect(ranked.map((r) => [r.learnerId, r.rank])).toEqual([[2, 1], [1, 2]]);
    expect(ranked[0]!.percent).toBeCloseTo(76, 0); // bài cũ 5 tuần trước chỉ còn ~32%
  });

  it("đồng điểm: nhiều video đúng hạn hơn xếp trên, rồi nộp sớm hơn; bằng hết thì ngang hạng; bỏ đội BTC", () => {
    const r = (id: number, vids: number, early: number | null, team = "🐟 Đội Cá Chép 02"): ScoreRow => ({
      learner_id: id, full_name: `HV ${id}`, team_name: team, due_at: "2026-11-10", earned: 5, max: 10, on_time_videos: vids, hours_early: early, provisional: 0,
    });
    const { ranked } = rank([r(1, 1, 2), r(2, 2, 1), r(3, 1, 5), r(4, 1, 2), r(5, 9, 9, "BTC")], "2026-11-11");
    expect(ranked.map((x) => [x.learnerId, x.rank])).toEqual([[2, 1], [3, 2], [1, 3], [4, 3]]);
  });
});
