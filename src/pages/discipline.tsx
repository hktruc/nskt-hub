// Kỷ luật (lỗi nhẹ / lỗi nặng): tổng quan, Zoom, bài tập, nhóm & trưởng nhóm, từng thành viên, duyệt miễn.

import type { Child } from "hono/jsx";
import { COURSE } from "../course";
import { teamLabel } from "../domain/teams";
import { formatVN } from "../dates";
import {
  SEVERITY_LABEL,
  pct,
  weekRange,
  type BaiState,
  type DAssignment,
  type DSession,
  type Fault,
  type LearnerResult,
  type TeamResult,
  type Totals,
  type WeekResult,
  type ZoomState,
} from "../discipline/engine";
import type { Exemption, TeamReport } from "../discipline/data";
import { Layout } from "../layout";

const CFG = COURSE.discipline;
export type Viewer = { full: boolean; teams: string[] | null; nav: "full" | "leader" };

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const when = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : "—");
const shortTitle = (t: string) => t.replace(/\s+/g, " ").trim();
export const sessionName = (s: DSession, i?: number) => `${i !== undefined ? `Buổi ${i + 1} · ` : ""}${ddmm(s.startAt)} ${s.startAt.slice(11, 16)}${s.title ? ` · ${s.title}` : ""}`;

const TABS: [string, string][] = [
  ["/", "Dashboard"],
  ["/ky-luat/zoom", "Điểm danh Zoom"],
  ["/ky-luat/bai-tap", "Bài tập"],
  ["/ky-luat/nhom", "Nhóm"],
  ["/ky-luat/thanh-vien", "Từng thành viên"],
  ["/ky-luat/mien", "Duyệt miễn"],
  ["/ky-luat/truong-nhom", "Trưởng nhóm"],
];

export function DisciplineShell(props: { tab: string; title: string; v: Viewer; children?: Child; notice?: string }) {
  return (
    <Layout title={props.title} nav={props.v.nav}>
      <h1>{props.title}</h1>
      {props.v.full ? (
        <nav class="chips" aria-label="Chọn trang">
          {TABS.map(([href, label]) => (
            <a class={`chip${props.tab === href ? " on" : ""}`} href={href}>
              {label}
            </a>
          ))}
        </nav>
      ) : null}
      {props.notice ? (
        <p class="notice toast" role="status">
          ✓ {props.notice}
        </p>
      ) : null}
      {props.children}
    </Layout>
  );
}

function Meter(props: { v: number | null }) {
  if (props.v === null) return <span class="muted">—</span>;
  const cls = props.v >= 80 ? "s-ok" : props.v >= 50 ? "s-mid" : "s-bad";
  return (
    <span class="meter">
      <span class="sbar">
        <span class={cls} style={`flex:${props.v}`} />
        <span style={`flex:${100 - props.v}`} />
      </span>
      <b>{props.v}%</b>
    </span>
  );
}

function Faults(props: { n: { nhe: number; nang: number } }) {
  return (
    <span class="faults">
      {props.n.nang ? <span class="badge bad">{props.n.nang} nặng</span> : null}
      {props.n.nhe ? <span class="badge warn">{props.n.nhe} nhẹ</span> : null}
      {!props.n.nang && !props.n.nhe ? <span class="badge ok">0 lỗi</span> : null}
    </span>
  );
}

const BAI_STATE: Record<BaiState, [string, string]> = {
  "dung-han": ["Đúng hạn", "ok"],
  tre: ["Nộp trễ", "warn"],
  "chua-nop": ["Không nộp", "bad"],
  "chua-den-han": ["Chưa tới hạn", ""],
  mien: ["Được miễn", "ok"],
  dung: ["Đã dừng", ""],
};
const ZOOM_STATE: Record<ZoomState, [string, string]> = {
  "dung-gio": ["Có mặt đúng giờ", "ok"],
  tre: ["Vào trễ", "warn"],
  vang: ["Vắng", "bad"],
  mien: ["Được miễn", "ok"],
  dung: ["Đã dừng", ""],
  "chua-dien-ra": ["Chưa diễn ra", ""],
};
const State = (p: { s: [string, string] }) => <span class={`badge ${p.s[1]}`}>{p.s[0]}</span>;
const FaultList = (p: { f: Fault[] }) =>
  p.f.length ? (
    <span class="small">
      {p.f.map((f) => (
        <span class={`badge ${f.severity === "nang" ? "bad" : "warn"}`} title={f.label}>
          {SEVERITY_LABEL[f.severity]}: {f.label}
        </span>
      ))}
    </span>
  ) : (
    <span class="muted small">—</span>
  );

function RuleNote() {
  const r = CFG.rules;
  const lab = (s: string | null) => (s === "nang" ? "lỗi nặng" : s === "nhe" ? "lỗi nhẹ" : "không tính lỗi");
  return (
    <details class="card-item small">
      <summary>Cách tính lỗi</summary>
      <ul>
        <li>Bài ngày qua hạn mà không nộp: {lab(r.dailyMissing)}. Nộp bù sau hạn: {lab(r.dailyLate)} (vẫn ghi "nộp trễ").</li>
        <li>Bài tuần nộp trễ: {lab(r.weeklyLate)}. Qua hạn mà không nộp: {lab(r.weeklyMissing)}.</li>
        <li>
          Zoom: vào sau giờ bắt đầu quá {CFG.zoomLateMinutes} phút: {lab(r.zoomLate)}. Vắng: {lab(r.zoomAbsent)}. Không bật camera (trưởng nhóm báo): {lab(r.cameraOff)}.
        </li>
        <li>Có mặt đúng giờ và bật camera, mục chưa tới hạn, mục BTC duyệt miễn: không lỗi.</li>
        <li>
          Điểm lỗi: lỗi nhẹ = {CFG.points.nhe}, lỗi nặng = {CFG.points.nang}. Xếp hạng nhóm theo <b>điểm lỗi trung bình mỗi thành viên đang tham gia</b> (ít hơn xếp trên),
          bằng nhau thì nhóm nộp bài đúng hạn nhiều hơn xếp trên.
        </li>
      </ul>
    </details>
  );
}

export function TeamTable(props: { teams: TeamResult[]; journals?: Set<string>; journalWeek?: number }) {
  return (
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Nhóm</th>
            <th>Thành viên</th>
            <th>Điểm lỗi TB</th>
            <th>Lỗi</th>
            <th>Nộp đúng hạn</th>
            <th>Dự Zoom</th>
            {props.journals ? <th>Nhật ký tuần {props.journalWeek}</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.teams.map((t) => (
            <tr>
              <td>
                <b>{t.rank}</b>
              </td>
              <td>
                <a href={`/ky-luat/nhom/${t.team}`}>{teamLabel(t.team)}</a>
              </td>
              <td>
                {t.active}
                {t.active !== t.members ? <span class="muted small"> / {t.members}</span> : null}
              </td>
              <td>
                <b>{t.avgPoints.toLocaleString("vi-VN")}</b>
              </td>
              <td>
                <Faults n={t} />
              </td>
              <td>
                <Meter v={t.onTimeRate} />
              </td>
              <td>
                <Meter v={t.zoomRate} />
              </td>
              {props.journals ? <td>{props.journals.has(t.team) ? <span class="badge ok">Đã gửi</span> : <span class="badge bad">Chưa gửi</span>}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekChart(props: { weeks: WeekResult[]; current: number }) {
  return (
    <div class="scroll">
      <table class="weeks">
        <thead>
          <tr>
            <th>Tuần</th>
            <th>Nộp đúng hạn</th>
            <th>Dự Zoom</th>
            <th>Lỗi nhẹ</th>
            <th>Lỗi nặng</th>
          </tr>
        </thead>
        <tbody>
          {props.weeks.map((w) => (
            <tr class={w.week > props.current ? "muted" : ""}>
              <td>
                <b>Tuần {w.week}</b>
                <div class="small muted">
                  {ddmm(w.from)}–{ddmm(w.to)}
                </div>
              </td>
              <td>{w.due ? <Meter v={pct(w.onTime, w.due)} /> : <span class="muted small">{w.week > props.current ? "chưa tới" : "—"}</span>}</td>
              <td>{w.zoomPast ? <Meter v={pct(w.zoomPresent, w.zoomPast)} /> : <span class="muted small">—</span>}</td>
              <td>{w.nhe || (w.due ? 0 : "")}</td>
              <td>{w.nang || (w.due || w.zoomPast ? 0 : "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- 1. Tổng quan ----------------

export function DisciplineHomePage(props: {
  v: Viewer;
  t: Totals;
  weeks: WeekResult[];
  teams: TeamResult[];
  currentWeek: number;
  journals: Set<string>;
  lastSession: { s: DSession; onTime: number; late: number; absent: number; cameraOff: number } | null;
  updatedAt: string | null;
}) {
  const t = props.t;
  return (
    <DisciplineShell tab="/" title="Dashboard" v={props.v}>
      <p class="muted small">
        {COURSE.brand.name} · tuần {props.currentWeek}/{CFG.weeks} · dữ liệu dh3g cập nhật {formatVN(props.updatedAt)}
      </p>
      <div class="tiles">
        <div class="tile">
          <div class="lbl">Thành viên</div>
          <div class="num">{t.members}</div>
          <div class="small muted">{COURSE.teams.count} nhóm</div>
        </div>
        <div class="tile">
          <div class="lbl">Đang tham gia</div>
          <div class="num">{t.active}</div>
          {t.members - t.active ? <div class="small muted">{t.members - t.active} đã dừng</div> : null}
        </div>
        <div class="tile">
          <div class="lbl">Nộp bài đúng hạn</div>
          <div class="num">{t.onTimeRate ?? "—"}%</div>
          <div class="small muted">đã nộp (cả trễ) {t.doneRate ?? "—"}%</div>
        </div>
        <div class="tile">
          <div class="lbl">Tham gia Zoom</div>
          <div class="num">{t.zoomRate ?? "—"}%</div>
        </div>
        <a class="tile" href="/ky-luat/thanh-vien">
          <div class="lbl">Lỗi nhẹ</div>
          <div class="num" style={t.nhe ? "color:var(--warn-fg)" : ""}>
            {t.nhe}
          </div>
        </a>
        <a class="tile" href="/ky-luat/thanh-vien">
          <div class="lbl">Lỗi nặng</div>
          <div class="num" style={t.nang ? "color:var(--bad-fg)" : ""}>
            {t.nang}
          </div>
        </a>
      </div>

      {props.lastSession ? (
        <p class="card-item">
          <b>Zoom gần nhất</b> ({sessionName(props.lastSession.s)}): {props.lastSession.onTime} đúng giờ · {props.lastSession.late} vào trễ · {props.lastSession.absent} vắng ·{" "}
          {props.lastSession.cameraOff} không bật camera.{" "}
          <a href={`/ky-luat/zoom?buoi=${props.lastSession.s.id}`}>Xem danh sách →</a>
        </p>
      ) : null}

      <h2>Bảng xếp hạng {COURSE.teams.count} nhóm</h2>
      <TeamTable teams={props.teams} journals={props.journals} journalWeek={props.currentWeek} />
      <RuleNote />

      <h2>Tiến độ qua {CFG.weeks} tuần</h2>
      <WeekChart weeks={props.weeks} current={props.currentWeek} />
    </DisciplineShell>
  );
}

// ---------------- 2. Điểm danh Zoom ----------------

export function ZoomPage(props: {
  v: Viewer;
  sessions: { s: DSession; onTime: number; late: number; absent: number; cameraOff: number; exempt: number; past: boolean }[];
  selected: DSession | null;
  results: LearnerResult[];
  cameraReports: TeamReport[];
  notice?: string;
}) {
  const sel = props.selected;
  const idx = sel ? props.sessions.findIndex((x) => x.s.id === sel.id) : -1;
  const rows = sel ? props.results.map((r) => ({ r, z: r.zoom.find((z) => z.s.id === sel.id)! })).filter((x) => x.z) : [];
  const list = (st: ZoomState) => rows.filter((x) => x.z.state === st);
  const camOff = rows.filter((x) => x.z.cameraOff);
  const teams = [...new Set(props.results.map((r) => r.l.team))].sort();
  const reported = (team: string) => props.cameraReports.find((c) => c.team === team && sel && c.ref === String(sel.id));
  const People = (p: { xs: typeof rows; time?: boolean }) =>
    p.xs.length ? (
      <ul class="small people">
        {p.xs.map((x) => (
          <li>
            <a href={`/ky-luat/hv/${x.r.l.id}`}>{x.r.l.name}</a> <span class="muted">· {teamLabel(x.r.l.team)}</span>
            {p.time && x.z.attendedAt ? <span class="muted"> · vào {x.z.attendedAt.slice(11, 16)}</span> : null}
            {x.z.note ? <span class="muted"> · {x.z.note}</span> : null}
          </li>
        ))}
      </ul>
    ) : (
      <p class="muted small">Không có ai.</p>
    );
  return (
    <DisciplineShell tab="/ky-luat/zoom" title="Điểm danh Zoom" v={props.v} notice={props.notice}>
      <p class="muted small">
        Có mặt / vào trễ / vắng lấy tự động từ dh3g (vào sau giờ bắt đầu quá {CFG.zoomLateMinutes} phút là trễ). Bật camera: dh3g không ghi nhận, <b>trưởng nhóm báo</b> ngay trên trang này.
      </p>
      <h2>Tổng hợp {props.sessions.length} buổi</h2>
      {props.sessions.length === 0 ? <p class="muted">dh3g chưa có buổi Zoom nào từ {ddmm(CFG.startDate)}.</p> : null}
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Buổi</th>
              <th>Đúng giờ</th>
              <th>Vào trễ</th>
              <th>Vắng</th>
              <th>Không camera</th>
              <th>Tham gia</th>
            </tr>
          </thead>
          <tbody>
            {props.sessions.map((x, i) => (
              <tr class={sel?.id === x.s.id ? "on" : ""}>
                <td>
                  <a href={`/ky-luat/zoom?buoi=${x.s.id}`}>{sessionName(x.s, i)}</a>
                </td>
                {x.past ? (
                  <>
                    <td>{x.onTime}</td>
                    <td>{x.late}</td>
                    <td>{x.absent}</td>
                    <td>{x.cameraOff}</td>
                    <td>
                      <Meter v={pct(x.onTime + x.late, x.onTime + x.late + x.absent)} />
                    </td>
                  </>
                ) : (
                  <td colspan={5} class="muted small">
                    Chưa diễn ra
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel ? (
        <>
          <h2>{sessionName(sel, idx)}</h2>
          <div class="grid2">
            <section>
              <h3>Có mặt đúng giờ ({list("dung-gio").length})</h3>
              <People xs={list("dung-gio")} time />
            </section>
            <section>
              <h3>Vào trễ ({list("tre").length})</h3>
              <People xs={list("tre")} time />
            </section>
            <section>
              <h3>Vắng ({list("vang").length})</h3>
              <People xs={list("vang")} />
            </section>
            <section>
              <h3>Không bật camera ({camOff.length})</h3>
              <People xs={camOff} />
            </section>
          </div>
          {list("mien").length ? (
            <>
              <h3>Được BTC miễn ({list("mien").length})</h3>
              <People xs={list("mien")} />
            </>
          ) : null}

          <h2>Báo cáo camera của trưởng nhóm</h2>
          <p class="muted small">Đánh dấu người có mặt nhưng không bật camera, rồi bấm Lưu. Lưu lại lần nữa sẽ thay danh sách cũ của nhóm.</p>
          {teams
            .filter((team) => props.v.teams === null || props.v.teams.includes(team))
            .map((team) => {
              const present = rows.filter((x) => x.r.l.team === team && (x.z.state === "dung-gio" || x.z.state === "tre"));
              const rep = reported(team);
              return (
                <details class="card-item" open={props.v.teams !== null}>
                  <summary>
                    <b>{teamLabel(team)}</b>{" "}
                    {rep ? (
                      <span class="badge ok">
                        Đã báo cáo {formatVN(rep.at)} · {rep.content?.off ?? 0} không camera
                      </span>
                    ) : (
                      <span class="badge bad">Chưa báo cáo</span>
                    )}
                  </summary>
                  {present.length ? (
                    <form method="post" action="/ky-luat/zoom/camera">
                      <input type="hidden" name="buoi" value={String(sel.id)} />
                      <input type="hidden" name="doi" value={team} />
                      {present.map((x) => (
                        <label class="tchk" style="display:block">
                          <input type="checkbox" name="tat" value={String(x.r.l.id)} checked={x.z.cameraOff} /> {x.r.l.name} <span class="muted small">không bật camera</span>
                        </label>
                      ))}
                      <button class="secondary">Lưu báo cáo camera {teamLabel(team)}</button>
                    </form>
                  ) : (
                    <p class="muted small">Không có ai của nhóm có mặt trong buổi này (theo dh3g).</p>
                  )}
                </details>
              );
            })}
        </>
      ) : null}
    </DisciplineShell>
  );
}

// ---------------- 3. Bài tập ----------------

export function HomeworkPage(props: { v: Viewer; assignments: DAssignment[]; results: LearnerResult[]; selected: DAssignment | null; now: string }) {
  const stat = (a: DAssignment, rs = props.results) => {
    const rows = rs.map((r) => r.bai.find((b) => b.a.id === a.id)!).filter(Boolean);
    const c = (s: BaiState) => rows.filter((b) => b.state === s).length;
    return { ok: c("dung-han"), late: c("tre"), miss: c("chua-nop"), wait: c("chua-den-han"), exempt: c("mien") };
  };
  const Section = (p: { daily: boolean }) => {
    const as = props.assignments.filter((a) => (a.type === "NORMAL") === p.daily);
    return (
      <>
        <h2>
          {p.daily ? "Bài tập ngày" : "Bài tập tuần"} ({as.length})
        </h2>
        {as.length ? (
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Bài</th>
                  <th>Hạn nộp</th>
                  <th>Đúng hạn</th>
                  <th>Nộp trễ</th>
                  <th>Không nộp</th>
                  <th>Hoàn thành đúng hạn</th>
                </tr>
              </thead>
              <tbody>
                {[...as].reverse().map((a) => {
                  const s = stat(a);
                  const passed = a.dueAt <= props.now;
                  return (
                    <tr class={props.selected?.id === a.id ? "on" : ""}>
                      <td>
                        <a href={`/ky-luat/bai-tap?bt=${a.id}`}>{shortTitle(a.title)}</a>
                      </td>
                      <td class="small">{when(a.dueAt)}</td>
                      <td>{s.ok}</td>
                      <td>{s.late}</td>
                      <td>{passed ? s.miss : <span class="muted small">chưa tới hạn ({s.wait} chưa nộp)</span>}</td>
                      <td>{passed ? <Meter v={pct(s.ok, s.ok + s.late + s.miss)} /> : <span class="muted small">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="muted">Chưa có bài.</p>
        )}
      </>
    );
  };
  const sel = props.selected;
  const teams = [...new Set(props.results.map((r) => r.l.team))].sort();
  const missing = sel
    ? props.results
        .map((r) => ({ r, b: r.bai.find((b) => b.a.id === sel.id)! }))
        .filter((x) => x.b && (x.b.state === "chua-nop" || x.b.state === "tre" || x.b.state === "chua-den-han"))
    : [];
  return (
    <DisciplineShell tab="/ky-luat/bai-tap" title="Bài tập" v={props.v}>
      <p class="muted small">Tình trạng lấy từ dh3g: đúng hạn / nộp trễ / không nộp (qua hạn mà chưa nộp). Bấm vào một bài để xem ai chưa hoàn thành, theo từng nhóm.</p>
      {sel ? (
        <section class="card-item">
          <h2 style="margin-top:0">{shortTitle(sel.title)}</h2>
          <p class="small muted">Hạn nộp {when(sel.dueAt)}</p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th>Đúng hạn</th>
                  <th>Nộp trễ</th>
                  <th>Không nộp</th>
                  <th>Hoàn thành đúng hạn</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const s = stat(
                    sel,
                    props.results.filter((r) => r.l.team === team),
                  );
                  return (
                    <tr>
                      <td>{teamLabel(team)}</td>
                      <td>{s.ok}</td>
                      <td>{s.late}</td>
                      <td>{s.miss}</td>
                      <td>
                        <Meter v={pct(s.ok, s.ok + s.late + s.miss + (sel.dueAt > props.now ? s.wait : 0))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>Chưa hoàn thành đúng hạn ({missing.length})</h3>
          {missing.length ? (
            <ul class="small people">
              {missing.map((x) => (
                <li>
                  <a href={`/ky-luat/hv/${x.r.l.id}`}>{x.r.l.name}</a> <span class="muted">· {teamLabel(x.r.l.team)}</span> <State s={BAI_STATE[x.b.state]} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted small">Mọi người đều đã nộp đúng hạn.</p>
          )}
        </section>
      ) : null}
      <Section daily />
      <Section daily={false} />
    </DisciplineShell>
  );
}

// ---------------- 4. Từng thành viên ----------------

export function MembersPage(props: { v: Viewer; results: LearnerResult[]; sort: string }) {
  const rs = [...props.results];
  if (props.sort === "ten") rs.sort((a, b) => a.l.name.localeCompare(b.l.name, "vi"));
  else if (props.sort === "nhom") rs.sort((a, b) => a.l.team.localeCompare(b.l.team) || b.points - a.points);
  else rs.sort((a, b) => b.points - a.points || b.nang - a.nang || a.l.name.localeCompare(b.l.name, "vi"));
  const Th = (p: { k: string; label: string }) => (
    <th>
      <a href={`/ky-luat/thanh-vien?xep=${p.k}`} class={props.sort === p.k || (p.k === "loi" && !["ten", "nhom"].includes(props.sort)) ? "on" : ""}>
        {p.label}
      </a>
    </th>
  );
  return (
    <DisciplineShell tab="/ky-luat/thanh-vien" title="Từng thành viên" v={props.v}>
      <p class="muted small">Bấm tên để xem lịch sử Zoom, bài ngày, bài tuần và duyệt miễn. Bấm tiêu đề cột để sắp xếp.</p>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <Th k="ten" label="Họ tên" />
              <Th k="nhom" label="Nhóm" />
              <Th k="loi" label="Điểm lỗi" />
              <th>Lỗi</th>
              <th>Nộp đúng hạn</th>
              <th>Zoom</th>
            </tr>
          </thead>
          <tbody>
            {rs.map((r) => (
              <tr class={r.active ? "" : "muted"}>
                <td>
                  <a href={`/ky-luat/hv/${r.l.id}`}>{r.l.name}</a>
                  {r.active ? null : <span class="small"> (đã dừng)</span>}
                </td>
                <td>{teamLabel(r.l.team)}</td>
                <td>
                  <b>{r.points}</b>
                </td>
                <td>
                  <Faults n={r} />
                </td>
                <td>
                  {r.onTime}/{r.due}
                </td>
                <td>
                  {r.zoomPresent}/{r.zoomPast}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DisciplineShell>
  );
}

// ---------------- 5. Chi tiết cá nhân ----------------

function ExemptForm(props: { id: number; kind: "bai" | "zoom"; ref: number; exempt: boolean }) {
  if (props.exempt)
    return (
      <form method="post" action={`/ky-luat/hv/${props.id}/mien`} class="inline">
        <input type="hidden" name="loai" value={props.kind} />
        <input type="hidden" name="ma" value={String(props.ref)} />
        <input type="hidden" name="bo" value="1" />
        <button class="link small">Bỏ miễn</button>
      </form>
    );
  return (
    <details class="inline-form">
      <summary class="small">Duyệt miễn</summary>
      <form method="post" action={`/ky-luat/hv/${props.id}/mien`}>
        <input type="hidden" name="loai" value={props.kind} />
        <input type="hidden" name="ma" value={String(props.ref)} />
        <input name="ly_do" required placeholder="Lý do (bắt buộc)" maxlength={500} />
        <button class="secondary small">Miễn</button>
      </form>
    </details>
  );
}

export function LearnerPage(props: { v: Viewer; r: LearnerResult; notice?: string; today: string }) {
  const r = props.r;
  const total = r.bai.length + r.zoom.length;
  const finished = r.bai.filter((b) => b.state === "dung-han" || b.state === "tre" || b.state === "mien").length + r.zoom.filter((z) => z.state === "dung-gio" || z.state === "tre" || z.state === "mien").length;
  const canEdit = props.v.full;
  const BaiTable = (p: { daily: boolean }) => {
    const rows = r.bai.filter((b) => b.daily === p.daily);
    return (
      <>
        <h2>
          {p.daily ? "Bài tập ngày" : "Bài tập tuần"} ({rows.length})
        </h2>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Bài</th>
                <th>Hạn</th>
                <th>Tình trạng</th>
                <th>Lỗi</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((b) => (
                <tr>
                  <td>{shortTitle(b.a.title)}</td>
                  <td class="small">{when(b.a.dueAt)}</td>
                  <td>
                    <State s={BAI_STATE[b.state]} />
                    {b.submittedAt ? <div class="small muted">nộp {when(b.submittedAt)}</div> : null}
                    {b.note ? <div class="small muted">Lý do: {b.note}</div> : null}
                  </td>
                  <td>
                    <FaultList f={b.faults} />
                  </td>
                  {canEdit ? <td>{b.state !== "dung" && b.state !== "chua-den-han" && b.state !== "dung-han" ? <ExemptForm id={r.l.id} kind="bai" ref={b.a.id} exempt={b.state === "mien"} /> : null}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };
  return (
    <DisciplineShell tab="/ky-luat/thanh-vien" title={r.l.name} v={props.v} notice={props.notice}>
      <p>
        <a href={`/ky-luat/nhom/${r.l.team}`}>{teamLabel(r.l.team)}</a>
        {r.active ? null : <span class="badge">Đã dừng tham gia từ {ddmm(r.l.stoppedFrom!)}</span>}
      </p>
      <div class="tiles">
        <div class="tile">
          <div class="lbl">Lỗi nhẹ</div>
          <div class="num" style={r.nhe ? "color:var(--warn-fg)" : ""}>
            {r.nhe}
          </div>
        </div>
        <div class="tile">
          <div class="lbl">Lỗi nặng</div>
          <div class="num" style={r.nang ? "color:var(--bad-fg)" : ""}>
            {r.nang}
          </div>
        </div>
        <div class="tile">
          <div class="lbl">Tổng điểm lỗi</div>
          <div class="num">{r.points}</div>
        </div>
        <div class="tile">
          <div class="lbl">Tiến độ hành trình</div>
          <div class="num">{pct(finished, total) ?? 0}%</div>
          <div class="small muted">
            {finished}/{total} mục (bài tập + Zoom)
          </div>
        </div>
      </div>

      <h2>Zoom ({r.zoom.length} buổi)</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Buổi</th>
              <th>Tình trạng</th>
              <th>Camera</th>
              <th>Lỗi</th>
              {canEdit ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {r.zoom.map((z, i) => (
              <tr>
                <td>{sessionName(z.s, i)}</td>
                <td>
                  <State s={ZOOM_STATE[z.state]} />
                  {z.attendedAt ? <div class="small muted">vào {z.attendedAt.slice(11, 16)}</div> : null}
                  {z.note ? <div class="small muted">Lý do: {z.note}</div> : null}
                </td>
                <td class="small">{z.state === "dung-gio" || z.state === "tre" ? (z.cameraOff ? "Không bật" : "—") : ""}</td>
                <td>
                  <FaultList f={z.faults} />
                </td>
                {canEdit ? <td>{z.state === "tre" || z.state === "vang" || z.state === "mien" || z.cameraOff ? <ExemptForm id={r.l.id} kind="zoom" ref={z.s.id} exempt={z.state === "mien"} /> : null}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BaiTable daily />
      <BaiTable daily={false} />

      {canEdit ? (
        <>
          <h2>Dừng tham gia</h2>
          {r.l.stoppedFrom ? (
            <form method="post" action={`/ky-luat/hv/${r.l.id}/dung`} class="actions">
              <input type="hidden" name="bo" value="1" />
              <p class="small">
                Đã dừng từ {ddmm(r.l.stoppedFrom)}
                {r.l.stopReason ? ` · ${r.l.stopReason}` : ""}. Từ ngày đó không tính lỗi, không tính vào "đang tham gia".
              </p>
              <button class="secondary">Cho tham gia lại</button>
            </form>
          ) : (
            <form method="post" action={`/ky-luat/hv/${r.l.id}/dung`} class="auth-form">
              <label for="tu">Dừng từ ngày</label>
              <input id="tu" name="tu" type="date" value={props.today} required />
              <label for="lyd">Lý do</label>
              <input id="lyd" name="ly_do" maxlength={500} />
              <button class="secondary">Đánh dấu dừng tham gia</button>
            </form>
          )}
        </>
      ) : null}
    </DisciplineShell>
  );
}

// ---------------- 6. Nhóm và trưởng nhóm ----------------

export function TeamsPage(props: { v: Viewer; teams: TeamResult[]; journals: Set<string>; currentWeek: number }) {
  return (
    <DisciplineShell tab="/ky-luat/nhom" title={`${COURSE.teams.count} nhóm`} v={props.v}>
      <TeamTable teams={props.teams} journals={props.journals} journalWeek={props.currentWeek} />
      <RuleNote />
    </DisciplineShell>
  );
}

export function TeamPage(props: {
  v: Viewer;
  team: string;
  t: TeamResult;
  results: LearnerResult[];
  sessions: DSession[];
  cameraReports: TeamReport[];
  journals: TeamReport[];
  week: number;
  currentWeek: number;
  canWrite: boolean;
  notice?: string;
}) {
  const j = props.journals.find((x) => x.ref === String(props.week));
  const past = props.sessions.filter((s) => props.results.some((r) => r.zoom.some((z) => z.s.id === s.id && z.state !== "chua-dien-ra")));
  return (
    <DisciplineShell tab="/ky-luat/nhom" title={teamLabel(props.team)} v={props.v} notice={props.notice}>
      <p class="muted small">
        Hạng {props.t.rank}/{COURSE.teams.count} · {props.t.active} thành viên đang tham gia
        {props.t.active !== props.t.members ? ` (trên ${props.t.members})` : ""}
      </p>
      <div class="tiles">
        <div class="tile">
          <div class="lbl">Điểm lỗi TB / người</div>
          <div class="num">{props.t.avgPoints.toLocaleString("vi-VN")}</div>
        </div>
        <div class="tile">
          <div class="lbl">Lỗi</div>
          <div class="num" style="font-size:1rem;padding-top:8px">
            <Faults n={props.t} />
          </div>
        </div>
        <div class="tile">
          <div class="lbl">Nộp đúng hạn</div>
          <div class="num">{props.t.onTimeRate ?? "—"}%</div>
          <div class="small muted">đã nộp (cả trễ) {props.t.doneRate ?? "—"}%</div>
        </div>
        <div class="tile">
          <div class="lbl">Dự Zoom</div>
          <div class="num">{props.t.zoomRate ?? "—"}%</div>
        </div>
      </div>

      <h2>Kết quả từng thành viên</h2>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Điểm lỗi</th>
              <th>Lỗi</th>
              <th>Nộp đúng hạn</th>
              <th>Zoom</th>
            </tr>
          </thead>
          <tbody>
            {[...props.results]
              .sort((a, b) => b.points - a.points || a.l.name.localeCompare(b.l.name, "vi"))
              .map((r) => (
                <tr class={r.active ? "" : "muted"}>
                  <td>
                    <a href={`/ky-luat/hv/${r.l.id}`}>{r.l.name}</a>
                    {r.active ? null : <span class="small"> (đã dừng)</span>}
                  </td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                  <td>
                    <Faults n={r} />
                  </td>
                  <td>
                    {r.onTime}/{r.due}
                  </td>
                  <td>
                    {r.zoomPresent}/{r.zoomPast}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h2>Tình trạng báo cáo</h2>
      <ul class="small">
        {past.map((s, i) => {
          const rep = props.cameraReports.find((c) => c.ref === String(s.id));
          return (
            <li>
              Camera {sessionName(s, props.sessions.indexOf(s) >= 0 ? props.sessions.indexOf(s) : i)}:{" "}
              {rep ? <span class="badge ok">Đã báo cáo {formatVN(rep.at)}</span> : <span class="badge bad">Chưa báo cáo</span>}{" "}
              {props.canWrite ? <a href={`/ky-luat/zoom?buoi=${s.id}`}>Báo cáo →</a> : null}
            </li>
          );
        })}
        {Array.from({ length: props.currentWeek }, (_, i) => i + 1).map((w) => {
          const has = props.journals.some((x) => x.ref === String(w));
          return (
            <li>
              Nhật ký tuần {w}: {has ? <span class="badge ok">Đã gửi</span> : <span class="badge bad">Chưa gửi</span>}{" "}
              <a href={`/ky-luat/nhom/${props.team}?tuan=${w}#nhat-ky`}>Xem{props.canWrite ? " / viết" : ""} →</a>
            </li>
          );
        })}
      </ul>

      <h2 id="nhat-ky">
        Nhật ký nhóm · tuần {props.week} ({ddmm(weekRange(CFG, props.week).from)}–{ddmm(weekRange(CFG, props.week).to)})
      </h2>
      <nav class="chips" aria-label="Chọn tuần">
        {Array.from({ length: CFG.weeks }, (_, i) => i + 1).map((w) => (
          <a class={`chip${w === props.week ? " on" : ""}`} href={`/ky-luat/nhom/${props.team}?tuan=${w}#nhat-ky`}>
            Tuần {w}
            {props.journals.some((x) => x.ref === String(w)) ? " ✓" : ""}
          </a>
        ))}
      </nav>
      {j ? <p class="small muted">Gửi lúc {formatVN(j.at)} · {j.by}</p> : null}
      {props.canWrite ? (
        <form method="post" action={`/ky-luat/nhom/${props.team}/nhat-ky`} class="auth-form journal">
          <input type="hidden" name="tuan" value={String(props.week)} />
          {CFG.journalFields.map((f) => (
            <>
              <label for={`nk-${f.key}`}>{f.label}</label>
              <textarea id={`nk-${f.key}`} name={f.key} rows={3} maxlength={4000}>
                {j?.content?.[f.key] ?? ""}
              </textarea>
            </>
          ))}
          <button>{j ? "Cập nhật nhật ký" : "Gửi nhật ký tuần " + props.week}</button>
        </form>
      ) : j ? (
        <dl class="journal-view">
          {CFG.journalFields.map((f) => (
            <>
              <dt>{f.label}</dt>
              <dd>{j.content?.[f.key] || <span class="muted">—</span>}</dd>
            </>
          ))}
        </dl>
      ) : (
        <p class="muted">Nhóm chưa gửi nhật ký tuần này.</p>
      )}
    </DisciplineShell>
  );
}

// ---------------- 7. Duyệt miễn, dừng tham gia ----------------

export function ExemptionsPage(props: { v: Viewer; exemptions: Exemption[]; results: LearnerResult[]; titles: Map<string, string> }) {
  const byId = new Map(props.results.map((r) => [r.l.id, r]));
  const stopped = props.results.filter((r) => r.l.stoppedFrom);
  return (
    <DisciplineShell tab="/ky-luat/mien" title="Duyệt miễn, dừng tham gia" v={props.v}>
      <p class="muted small">
        Để duyệt miễn: mở trang của thành viên (mục <a href="/ky-luat/thanh-vien">Từng thành viên</a>), bấm "Duyệt miễn" ở dòng bài tập / buổi Zoom, ghi lý do. Mục được miễn không tính lỗi.
      </p>
      <h2>Đã duyệt miễn ({props.exemptions.length})</h2>
      {props.exemptions.length ? (
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Mục</th>
                <th>Lý do</th>
                <th>Người duyệt</th>
              </tr>
            </thead>
            <tbody>
              {props.exemptions.map((e) => {
                const r = byId.get(e.learnerId);
                return (
                  <tr>
                    <td>
                      <a href={`/ky-luat/hv/${e.learnerId}`}>{r?.l.name ?? `#${e.learnerId}`}</a>
                      {r ? <span class="muted small"> · {teamLabel(r.l.team)}</span> : null}
                    </td>
                    <td>{props.titles.get(`${e.kind}:${e.ref}`) ?? `${e.kind === "zoom" ? "Buổi Zoom" : "Bài"} #${e.ref}`}</td>
                    <td>{e.reason}</td>
                    <td class="small">
                      {e.by}
                      <div class="muted">{formatVN(e.at)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">Chưa có.</p>
      )}
      <h2>Dừng tham gia ({stopped.length})</h2>
      {stopped.length ? (
        <ul>
          {stopped.map((r) => (
            <li>
              <a href={`/ky-luat/hv/${r.l.id}`}>{r.l.name}</a> <span class="muted small">· {teamLabel(r.l.team)} · từ {ddmm(r.l.stoppedFrom!)}{r.l.stopReason ? ` · ${r.l.stopReason}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">Chưa có ai.</p>
      )}
    </DisciplineShell>
  );
}
