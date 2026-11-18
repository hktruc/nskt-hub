// Màn hình chấm chéo (lớp offline thứ Sáu): phần xử lý thuần, không đụng tới trang web, có kiểm thử riêng.
// Dựng lại theo cách màn hình chấm chéo cũ hoạt động, có sửa một lỗi đo độ dài khi chia trang (xem `paginate`).

export const TEAM_IDS = Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);
export const COLORS = {
  T01: "#f4cf9b", T02: "#f0aaa8", T03: "#c7b7ea", T04: "#9ecbf0", T05: "#9edfc5", T06: "#d8dc94",
  T07: "#f2bd84", T08: "#d5a7cf", T09: "#94d8d8", T10: "#b5d59b", T11: "#f2c5a8", T12: "#aebbe6",
};
/** Số chữ tối đa trên một trang nhận xét. */
export const PAGE_LIMIT = 720;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** "20/11/2026 19:48:05" (giờ trong Google Sheet) hoặc chuỗi ISO → mili giây; không đọc được thì 0. */
export function parseTime(s) {
  const v = String(s || "");
  const m = v.match(/(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d):(\d\d)/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Một lượt chấm hợp lệ: { khoa, gui, nguoiCham:{id,ten,doi}, nguoiNhan:{id,ten,doi}, tomTat, tieuChi:[{ten,diem,nhanXet}], diemTB }.
 * Đội phải là T01…T12, hai người khác nhau, có tên và có khoá nhận dạng.
 */
export function validRecord(r) {
  return !!r && typeof r.khoa === "string" && r.khoa !== "" &&
    TEAM_IDS.includes(r.nguoiCham?.doi) && TEAM_IDS.includes(r.nguoiNhan?.doi) &&
    r.nguoiCham.id !== r.nguoiNhan.id && !!r.nguoiCham.ten && !!r.nguoiNhan.ten;
}

/** Lọc lượt hợp lệ, gộp lượt cùng khoá (lấy bản mới nhất, giữ vị trí cũ), xếp theo giờ gửi rồi theo thứ tự nguồn. */
export function normalizeRecords(list) {
  const m = new Map();
  (list || []).forEach((r, sourceIndex) => {
    if (!validRecord(r)) return;
    const timestamp = parseTime(r.gui);
    const prev = m.get(r.khoa);
    m.set(r.khoa, { ...r, timestamp, sourceIndex: prev ? prev.sourceIndex : sourceIndex });
  });
  return [...m.values()].sort((a, b) => {
    if (a.timestamp && b.timestamp) return a.timestamp - b.timestamp || a.sourceIndex - b.sourceIndex;
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return a.sourceIndex - b.sourceIndex;
  });
}

/** Các mục chữ của một lượt: tóm tắt, từng tiêu chí (kèm điểm), điểm trung bình. Mục trống bị bỏ. */
export function fieldsOf(r) {
  const out = [];
  const tomTat = String(r.tomTat || "").trim();
  if (tomTat) out.push({ label: "Nhận xét tổng hợp", text: tomTat });
  for (const c of r.tieuChi || []) {
    const nhanXet = String(c.nhanXet || "").trim();
    const diem = String(c.diem ?? "").trim();
    if (nhanXet || diem) out.push({ label: String(c.ten || "Tiêu chí").trim(), text: `${diem ? `${diem} điểm · ` : ""}${nhanXet}`.trim() });
  }
  const tb = String(r.diemTB ?? "").trim();
  if (tb) out.push({ label: "Điểm trung bình", text: tb });
  return out;
}

const pieceLen = (f) => `${f.label}: ${f.text}`.length;
const pageLen = (page) => page.reduce((n, f) => n + pieceLen(f), 0) + 3 * Math.max(0, page.length - 1);

/**
 * Chia các mục chữ thành từng trang tối đa `limit` chữ, giữ nguyên văn, không cắt ý.
 * Mục dài hơn một trang được cắt theo từ, trang tiếp theo ghi "(tiếp)".
 * (Bản cũ đo độ dài các mục đã xếp bằng cách nối đối tượng thành chữ "[object Object]", nên trang có thể dài hơn giới hạn; bản này đo đúng.)
 */
export function paginate(fields, limit = PAGE_LIMIT) {
  const pages = [];
  let current = [];
  for (const f of fields) {
    if (pieceLen(f) > limit) {
      if (current.length) { pages.push(current); current = []; }
      let first = true;
      let part = "";
      const label = () => (first ? f.label : `${f.label} (tiếp)`);
      for (const w of f.text.split(/\s+/).filter(Boolean)) {
        const next = part ? `${part} ${w}` : w;
        if (part && label().length + 2 + next.length > limit) {
          pages.push([{ label: label(), text: part }]);
          first = false;
          part = w;
        } else part = next;
      }
      if (part) current = [{ label: label(), text: part }];
      continue;
    }
    if (current.length && pageLen(current) + 3 + pieceLen(f) > limit) { pages.push(current); current = []; }
    current.push(f);
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[{ label: "Nhận xét", text: "Không có nội dung chữ." }]];
}

/** Thời gian đọc một trang (mili giây): 3,5 giây + 28 ms mỗi chữ, trong khoảng 5–24 giây, nhân với hệ số tốc độ. */
export const readMs = (chars, speed = 1) => Math.max(5000, Math.min(24000, 3500 + chars * 28)) * speed;

export function formatDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "—";
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVN(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = (t) => parts.find((x) => x.type === t)?.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}

/** Số lượt đang chờ chiếu của mỗi đội nhận, tính từ vị trí `from`. */
export function pendingOf(records, from = 0) {
  const m = new Map();
  for (let i = from; i < records.length; i++) m.set(records[i].nguoiNhan.doi, (m.get(records[i].nguoiNhan.doi) || 0) + 1);
  return m;
}
