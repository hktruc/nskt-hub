import { describe, expect, it } from "vitest";

// Phần xử lý thuần của màn hình chấm chéo (chạy trên trình duyệt, viết bằng JavaScript thuần). Dữ liệu giả hoàn toàn.
const L = (await import(/* @vite-ignore */ new URL("../courses/nskt2026/public/cham-cheo-moi/logic.js", import.meta.url).href)) as any;

const rec = (khoa: string, gui: string, from: string, to: string, over: Record<string, unknown> = {}) => ({
  khoa,
  gui,
  nguoiCham: { id: `${from}01`, ten: `Người ${from}`, doi: from },
  nguoiNhan: { id: `${to}02`, ten: `Người ${to}`, doi: to },
  tomTat: "Tóm tắt",
  tieuChi: [{ ten: "Sơ đồ", diem: 4, nhanXet: "Rõ" }],
  diemTB: "4.0",
  ...over,
});

describe("màn hình chấm chéo: xử lý thuần", () => {
  it("giờ trong Google Sheet và ngày hôm nay theo giờ Việt Nam", () => {
    expect(L.parseTime("20/11/2026 19:48:05")).toBe(Date.UTC(2026, 10, 20, 19, 48, 5));
    expect(L.parseTime("rác")).toBe(0);
    expect(L.todayVN(new Date("2026-11-20T18:30:00Z"))).toBe("2026-11-21"); // 01:30 sáng ngày 21 giờ Việt Nam
    expect(L.formatDate("2026-11-20")).toBe("20/11/2026");
  });

  it("lọc lượt không hợp lệ, gộp lượt cùng khoá (lấy bản mới nhất), xếp theo giờ gửi", () => {
    const list = [
      rec("b", "20/11/2026 19:20:00", "T02", "T03"),
      rec("a", "20/11/2026 19:10:00", "T01", "T01"),
      rec("c", "20/11/2026 19:15:00", "T05", "T05", { nguoiNhan: { id: "T0501", ten: "Tự chấm", doi: "T05" } }), // tự chấm: bỏ
      rec("d", "20/11/2026 19:16:00", "TEST", "T04"), // đội không hợp lệ: bỏ
      rec("e", "20/11/2026 19:17:00", "T06", "T07", { nguoiCham: { id: "T0601", ten: "", doi: "T06" } }), // thiếu tên: bỏ
      rec("a", "20/11/2026 19:25:00", "T01", "T01", { tomTat: "Đã sửa" }), // sửa lại: giữ vị trí cũ, nhưng giờ gửi mới
      { ...rec("", "20/11/2026 19:01:00", "T01", "T02") }, // thiếu khoá: bỏ
    ];
    const out = L.normalizeRecords(list);
    expect(out.map((r: any) => r.khoa)).toEqual(["b", "a"]);
    expect(out[1].tomTat).toBe("Đã sửa");
    expect(L.normalizeRecords(undefined)).toEqual([]);
  });

  it("ghép nội dung: tóm tắt, tiêu chí kèm điểm, điểm trung bình; bỏ mục trống", () => {
    const f = L.fieldsOf(rec("x", "", "T01", "T02", { tomTat: "  Hay  ", tieuChi: [{ ten: "Sơ đồ", diem: 5, nhanXet: "Gọn" }, { ten: "Phản biện", diem: "", nhanXet: "" }, { ten: "Đặt câu hỏi", diem: 3, nhanXet: "" }] }));
    expect(f).toEqual([
      { label: "Nhận xét tổng hợp", text: "Hay" },
      { label: "Sơ đồ", text: "5 điểm · Gọn" },
      { label: "Đặt câu hỏi", text: "3 điểm ·" },
      { label: "Điểm trung bình", text: "4.0" },
    ]);
  });

  it("chia trang: giữ nguyên văn, không trang nào vượt giới hạn, mục dài được cắt theo từ", () => {
    const words = Array.from({ length: 400 }, (_, i) => `từ${i}`);
    const long = words.join(" ");
    const fields = [{ label: "A", text: "ngắn một" }, { label: "Nhận xét dài", text: long }, { label: "B", text: "ngắn hai" }];
    const pages = L.paginate(fields, 300);
    const len = (p: any[]) => p.reduce((n, f) => n + `${f.label}: ${f.text}`.length, 0) + 3 * Math.max(0, p.length - 1);
    // Mọi trang đều nằm trong giới hạn (trừ khi một từ đơn lẻ dài hơn giới hạn: ở đây không có).
    for (const p of pages) expect(len(p)).toBeLessThanOrEqual(300);
    // Ghép lại đủ mọi từ, đúng thứ tự.
    const text = pages.flat().map((f: any) => f.text).join(" ");
    expect(text).toBe(["ngắn một", long, "ngắn hai"].join(" "));
    expect(pages.flat().some((f: any) => f.label === "Nhận xét dài (tiếp)")).toBe(true);
    // Hai mục ngắn nằm chung một trang khi còn chỗ.
    expect(L.paginate([{ label: "A", text: "x" }, { label: "B", text: "y" }], 720)).toHaveLength(1);
    // Không có nội dung: vẫn có một trang báo.
    expect(L.paginate([], 720)).toEqual([[{ label: "Nhận xét", text: "Không có nội dung chữ." }]]);
  });

  it("thời gian đọc theo độ dài, trong khoảng 5–24 giây, nhân hệ số tốc độ", () => {
    expect(L.readMs(0)).toBe(5000);
    expect(L.readMs(300)).toBe(3500 + 300 * 28);
    expect(L.readMs(5000)).toBe(24000);
    expect(L.readMs(300, 0.35)).toBeCloseTo((3500 + 300 * 28) * 0.35);
  });

  it("số lượt đang chờ của mỗi đội nhận", () => {
    const rs = L.normalizeRecords([rec("1", "20/11/2026 19:01:00", "T01", "T02"), rec("2", "20/11/2026 19:02:00", "T03", "T02"), rec("3", "20/11/2026 19:03:00", "T02", "T05")]);
    expect([...L.pendingOf(rs)]).toEqual([["T02", 2], ["T05", 1]]);
    expect([...L.pendingOf(rs, 2)]).toEqual([["T05", 1]]);
  });

  it("giờ ngắn và câu báo độ mới", () => {
    expect(L.shortTime("20/11/2026 19:11:34")).toBe("19:11");
    expect(L.shortTime("20/11/2026 19:11:34", true)).toBe("19:11:34");
    expect(L.shortTime("")).toBe("");
    expect(L.agoText(0)).toBe("Đã cập nhật vừa xong");
    expect(L.agoText(12)).toBe("Đã cập nhật 12 giây trước");
    expect(L.agoText(130)).toBe("Đã cập nhật 2 phút trước");
  });

  it("12 đội, mỗi đội một màu", () => {
    expect(L.TEAM_IDS).toHaveLength(12);
    expect(new Set(Object.values(L.COLORS)).size).toBe(12);
    expect(L.esc('<b onclick="x">&')).toBe("&lt;b onclick=&quot;x&quot;&gt;&amp;");
  });
});
