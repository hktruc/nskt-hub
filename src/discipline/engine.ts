// Kỷ luật: từ bài nộp + điểm danh Zoom (dh3g) + camera (trưởng nhóm nhập) + miễn / dừng (BTC nhập)
// tính lỗi nhẹ / lỗi nặng cho từng thành viên, rồi tổng hợp theo nhóm và theo tuần.
// Hàm thuần, không đọc D1: dữ liệu vào ở `DisciplineInput`, quy tắc ở hồ sơ khóa (`COURSE.discipline`).
// Mọi thời gian là giờ Việt Nam không ghi múi giờ ("2026-11-12T23:30:00"), như dh3g.

import type { CourseConfig, Severity } from "../course/types";

export type DCfg = CourseConfig["discipline"];

export type DLearner = { id: number; name: string; team: string; stoppedFrom: string | null; stopReason?: string | null };
export type DAssignment = { id: number; title: string; type: string; dueAt: string };
export type DSub = { learnerId: number; assignmentId: number; status: string | null; submittedAt: string | null };
export type DSession = { id: number; title: string; startAt: string; endAt: string | null };
export type DAtt = { learnerId: number; sessionId: number; attended: boolean; attendedAt: string | null };

export type DisciplineInput = {
  learners: DLearner[];
  assignments: DAssignment[];
  subs: DSub[];
  sessions: DSession[];
  atts: DAtt[];
  /** "mãBuổi:mãHọcViên" của những người trưởng nhóm đánh dấu không bật camera. */
  cameraOff: Set<string>;
  /** "mãHọcViên:bai:mãBài" hoặc "mãHọcViên:zoom:mãBuổi" → lý do BTC duyệt miễn. */
  exemptions: Map<string, string>;
  now: string;
};

export type BaiState = "dung-han" | "tre" | "chua-nop" | "chua-den-han" | "mien" | "dung";
export type ZoomState = "dung-gio" | "tre" | "vang" | "mien" | "dung" | "chua-dien-ra";

export type Fault = { severity: "nhe" | "nang"; label: string };

export type BaiRow = { a: DAssignment; daily: boolean; week: number; state: BaiState; submittedAt: string | null; faults: Fault[]; note?: string };
export type ZoomRow = { s: DSession; week: number; state: ZoomState; attendedAt: string | null; cameraOff: boolean; faults: Fault[]; note?: string };

export type LearnerResult = {
  l: DLearner;
  active: boolean;
  bai: BaiRow[];
  zoom: ZoomRow[];
  nhe: number;
  nang: number;
  points: number;
  /** Bài đã tới hạn (không tính bài được miễn / sau ngày dừng) và số bài nộp đúng hạn trong đó. */
  due: number;
  onTime: number;
  done: number; // đã nộp (đúng hạn + trễ)
  zoomPast: number;
  zoomPresent: number;
  zoomOnTime: number;
};

export const SEVERITY_LABEL = { nhe: "Lỗi nhẹ", nang: "Lỗi nặng" } as const;

/** Tuần thứ mấy của hành trình (1…cfg.weeks), tính từ ngày bắt đầu. */
export function journeyWeek(cfg: DCfg, at: string): number {
  const days = Math.floor((Date.parse(`${at.slice(0, 10)}T00:00:00Z`) - Date.parse(`${cfg.startDate}T00:00:00Z`)) / 86_400_000);
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), Math.max(cfg.weeks, 1));
}

/** Ngày đầu, ngày cuối của tuần hành trình. */
export function weekRange(cfg: DCfg, week: number): { from: string; to: string } {
  const t = Date.parse(`${cfg.startDate}T00:00:00Z`) + (week - 1) * 7 * 86_400_000;
  return { from: new Date(t).toISOString().slice(0, 10), to: new Date(t + 6 * 86_400_000).toISOString().slice(0, 10) };
}

/** Cộng phút vào thời gian giờ VN không múi giờ. */
export function addMinutes(at: string, min: number): string {
  return new Date(Date.parse(`${at.slice(0, 19)}Z`) + min * 60_000).toISOString().slice(0, 19);
}

const isDaily = (type: string) => type === "NORMAL";
const fault = (sev: Severity, label: string): Fault[] => (sev ? [{ severity: sev, label }] : []);

export function computeDiscipline(input: DisciplineInput, cfg: DCfg): LearnerResult[] {
  const subs = new Map(input.subs.map((s) => [`${s.learnerId}:${s.assignmentId}`, s]));
  const atts = new Map(input.atts.map((a) => [`${a.learnerId}:${a.sessionId}`, a]));
  const assignments = input.assignments.filter((a) => a.dueAt >= cfg.startDate).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id - b.id);
  const sessions = input.sessions.filter((s) => s.startAt >= cfg.startDate).sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id - b.id);
  const today = input.now.slice(0, 10);

  return input.learners.map((l) => {
    const stopped = (at: string) => l.stoppedFrom !== null && at.slice(0, 10) >= l.stoppedFrom;
    const r: LearnerResult = {
      l,
      active: !(l.stoppedFrom !== null && l.stoppedFrom <= today),
      bai: [],
      zoom: [],
      nhe: 0,
      nang: 0,
      points: 0,
      due: 0,
      onTime: 0,
      done: 0,
      zoomPast: 0,
      zoomPresent: 0,
      zoomOnTime: 0,
    };

    for (const a of assignments) {
      const s = subs.get(`${l.id}:${a.id}`);
      const daily = isDaily(a.type);
      const status = s?.status ?? "NOT_SUBMITTED";
      const passed = a.dueAt <= input.now;
      const exempt = input.exemptions.get(`${l.id}:bai:${a.id}`);
      let state: BaiState;
      let faults: Fault[] = [];
      if (stopped(a.dueAt)) state = "dung";
      else if (exempt !== undefined) state = "mien";
      else if (status === "DONE") state = "dung-han";
      else if (status === "OVERDUE" || status === "LATE") state = "tre";
      else state = passed ? "chua-nop" : "chua-den-han";

      if (state === "chua-nop") faults = fault(daily ? cfg.rules.dailyMissing : cfg.rules.weeklyMissing, daily ? "Không làm bài ngày" : "Không làm bài tuần");
      if (state === "tre") faults = fault(daily ? cfg.rules.dailyLate : cfg.rules.weeklyLate, daily ? "Nộp trễ bài ngày" : "Nộp trễ bài tuần");
      if (state === "dung-han" || state === "tre" || state === "chua-nop") {
        r.due++;
        if (state === "dung-han") r.onTime++;
        if (state !== "chua-nop") r.done++;
      }
      r.bai.push({ a, daily, week: journeyWeek(cfg, a.dueAt), state, submittedAt: s?.submittedAt ?? null, faults, note: exempt ?? (state === "dung" ? (l.stopReason ?? undefined) : undefined) });
    }

    for (const s of sessions) {
      const att = atts.get(`${l.id}:${s.id}`);
      const exempt = input.exemptions.get(`${l.id}:zoom:${s.id}`);
      const over = (s.endAt ?? addMinutes(s.startAt, 60)) <= input.now;
      const camOff = input.cameraOff.has(`${s.id}:${l.id}`);
      let state: ZoomState;
      let faults: Fault[] = [];
      if (stopped(s.startAt)) state = "dung";
      else if (exempt !== undefined) state = "mien";
      else if (att?.attended) state = att.attendedAt && att.attendedAt.slice(0, 19) > addMinutes(s.startAt, cfg.zoomLateMinutes) ? "tre" : "dung-gio";
      else state = over ? "vang" : "chua-dien-ra";

      if (state === "tre") faults = fault(cfg.rules.zoomLate, "Vào Zoom trễ");
      if (state === "vang") faults = fault(cfg.rules.zoomAbsent, "Vắng Zoom");
      if ((state === "tre" || state === "dung-gio") && camOff) faults = [...faults, ...fault(cfg.rules.cameraOff, "Không bật camera")];
      if (state === "dung-gio" || state === "tre" || state === "vang") {
        r.zoomPast++;
        if (state !== "vang") r.zoomPresent++;
        if (state === "dung-gio") r.zoomOnTime++;
      }
      r.zoom.push({ s, week: journeyWeek(cfg, s.startAt), state, attendedAt: att?.attendedAt ?? null, cameraOff: camOff && (state === "tre" || state === "dung-gio"), faults, note: exempt ?? (state === "dung" ? (l.stopReason ?? undefined) : undefined) });
    }

    for (const f of [...r.bai, ...r.zoom].flatMap((x) => x.faults)) {
      if (f.severity === "nhe") r.nhe++;
      else r.nang++;
    }
    r.points = r.nhe * cfg.points.nhe + r.nang * cfg.points.nang;
    return r;
  });
}

export const pct = (a: number, b: number): number | null => (b ? Math.round((100 * a) / b) : null);

export type TeamResult = {
  team: string;
  members: number; // trong nhóm
  active: number; // đang tham gia
  nhe: number;
  nang: number;
  points: number;
  avgPoints: number; // điểm lỗi trung bình mỗi thành viên đang tham gia
  onTimeRate: number | null;
  doneRate: number | null;
  zoomRate: number | null;
  rank: number;
};

/** Xếp hạng nhóm: điểm lỗi trung bình mỗi thành viên (ít hơn xếp trên), rồi tỷ lệ nộp đúng hạn (cao hơn xếp trên). */
export function rankTeams(results: LearnerResult[]): TeamResult[] {
  const by = new Map<string, LearnerResult[]>();
  for (const r of results) by.set(r.l.team, [...(by.get(r.l.team) ?? []), r]);
  const teams: TeamResult[] = [...by.entries()].map(([team, rs]) => {
    const act = rs.filter((r) => r.active);
    const sum = (f: (r: LearnerResult) => number) => rs.reduce((t, r) => t + f(r), 0);
    const points = sum((r) => r.points);
    return {
      team,
      members: rs.length,
      active: act.length,
      nhe: sum((r) => r.nhe),
      nang: sum((r) => r.nang),
      points,
      avgPoints: Math.round((10 * points) / Math.max(act.length, 1)) / 10,
      onTimeRate: pct(sum((r) => r.onTime), sum((r) => r.due)),
      doneRate: pct(sum((r) => r.done), sum((r) => r.due)),
      zoomRate: pct(sum((r) => r.zoomPresent), sum((r) => r.zoomPast)),
      rank: 0,
    };
  });
  teams.sort((a, b) => a.avgPoints - b.avgPoints || (b.onTimeRate ?? -1) - (a.onTimeRate ?? -1) || a.team.localeCompare(b.team));
  teams.forEach((t, i) => {
    const prev = teams[i - 1];
    t.rank = prev && prev.avgPoints === t.avgPoints && prev.onTimeRate === t.onTimeRate ? prev.rank : i + 1;
  });
  return teams;
}

export type WeekResult = { week: number; from: string; to: string; due: number; onTime: number; done: number; zoomPast: number; zoomPresent: number; nhe: number; nang: number };

/** Tiến độ qua từng tuần của hành trình. */
export function byWeek(results: LearnerResult[], cfg: DCfg): WeekResult[] {
  const weeks: WeekResult[] = Array.from({ length: cfg.weeks }, (_, i) => ({ week: i + 1, ...weekRange(cfg, i + 1), due: 0, onTime: 0, done: 0, zoomPast: 0, zoomPresent: 0, nhe: 0, nang: 0 }));
  for (const r of results) {
    for (const b of r.bai) {
      const w = weeks[b.week - 1]!;
      if (b.state === "dung-han" || b.state === "tre" || b.state === "chua-nop") {
        w.due++;
        if (b.state === "dung-han") w.onTime++;
        if (b.state !== "chua-nop") w.done++;
      }
      for (const f of b.faults) w[f.severity]++;
    }
    for (const z of r.zoom) {
      const w = weeks[z.week - 1]!;
      if (z.state === "dung-gio" || z.state === "tre" || z.state === "vang") {
        w.zoomPast++;
        if (z.state !== "vang") w.zoomPresent++;
      }
      for (const f of z.faults) w[f.severity]++;
    }
  }
  return weeks;
}

export type Totals = { members: number; active: number; onTimeRate: number | null; doneRate: number | null; zoomRate: number | null; nhe: number; nang: number; points: number };

export function totals(results: LearnerResult[]): Totals {
  const sum = (f: (r: LearnerResult) => number) => results.reduce((t, r) => t + f(r), 0);
  return {
    members: results.length,
    active: results.filter((r) => r.active).length,
    onTimeRate: pct(sum((r) => r.onTime), sum((r) => r.due)),
    doneRate: pct(sum((r) => r.done), sum((r) => r.due)),
    zoomRate: pct(sum((r) => r.zoomPresent), sum((r) => r.zoomPast)),
    nhe: sum((r) => r.nhe),
    nang: sum((r) => r.nang),
    points: sum((r) => r.points),
  };
}
