import type { Child } from "hono/jsx";
import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import type { AssignmentLine, AttCounts, Learner, LearnerRow, PeerReport, SessionReport, WeekRow } from "../reports/data";
import { shortVN } from "./submissions";

// Báo cáo thống kê (BTC, coach, admin): toàn khóa, buổi học offline, bài ngày, bài tuần, bài thi, người chấm.

const TABS = [
  ["/bao-cao", "Toàn khóa"],
  ["/bao-cao/buoi-hoc", "Buổi học offline"],
  ["/bao-cao/bai-ngay", "Bài tập ngày"],
  ["/bao-cao/bai-tuan", "Bài tập tuần"],
  ["/bao-cao/bai-thi", "Bài thi"],
  ["/bao-cao/cham-cheo", "Chấm chéo"],
  ["/bao-cao/hoc-vien", "Từng học viên"],
  ["/bao-cao/nguoi-cham", "Người chấm"],
] as const;

export function ReportShell(props: { tab: string; title: string; children?: Child }) {
  return (
    <Layout title={props.title}>
      <h1>Báo cáo</h1>
      <nav class="chips" aria-label="Chọn báo cáo">
        {TABS.map(([href, label]) => (
          <a class={`chip${props.tab === href ? " on" : ""}`} href={href}>
            {label}
          </a>
        ))}
      </nav>
      {props.children}
    </Layout>
  );
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Thanh chồng: đúng hạn (xanh) / trễ (vàng) / chưa (đỏ). */
function Stack(props: { ok: number; mid: number; bad: number; labels?: [string, string, string] }) {
  const t = props.ok + props.mid + props.bad;
  if (!t) return <span class="muted small">—</span>;
  const [a, b, c] = props.labels ?? ["đúng hạn", "trễ", "chưa nộp"];
  return (
    <span class="sbar" title={`${props.ok} ${a} · ${props.mid} ${b} · ${props.bad} ${c}`}>
      {props.ok ? <span class="s-ok" style={`flex:${props.ok}`} /> : null}
      {props.mid ? <span class="s-mid" style={`flex:${props.mid}`} /> : null}
      {props.bad ? <span class="s-bad" style={`flex:${props.bad}`} /> : null}
    </span>
  );
}
function Meter(props: { v: number | null }) {
  if (props.v === null) return <span class="muted">—</span>;
  const cls = props.v >= 80 ? "s-ok" : props.v >= 50 ? "s-mid" : "s-bad";
  return (
    <span class="meter">
      <span class="sbar">
        <span class={cls} style={`flex:${props.v}`} />
        <span class="s-empty" style={`flex:${100 - props.v}`} />
      </span>
      <b>{props.v}%</b>
    </span>
  );
}
function Legend(props: { labels?: [string, string, string] }) {
  const [a, b, c] = props.labels ?? ["Đúng hạn", "Trễ", "Chưa nộp"];
  return (
    <p class="small muted rlegend">
      <i class="sq s-ok" /> {a} <i class="sq s-mid" /> {b} <i class="sq s-bad" /> {c}
    </p>
  );
}

// ---------- Toàn khóa ----------
export function CourseReport(props: { weeks: WeekRow[]; learners: number }) {
  // Mỗi ô lấy tuần gần nhất CÓ số liệu (vd. tuần này chưa tới buổi học thứ Sáu thì lấy tuần trước).
  const tile = (label: string, key: "attendance" | "dailyOnTime" | "weeklyDone" | "feedbacks", unit = "%") => {
    const ws = props.weeks.filter((w) => w[key] !== null);
    const cur = ws[0], prev = ws[1];
    const v = cur ? (cur[key] as number) : null, p = prev ? (prev[key] as number) : null;
    return (
      <div class="tile">
        <div class="lbl">{label}</div>
        <div class="num">{v === null ? "—" : `${v}${unit}`}</div>
        <div class="small muted">tuần {cur ? ddmm(cur.from) : "—"}</div>
        {v !== null && p !== null && v !== p ? (
          <div class={`small trend ${v > p ? "good" : "bad"}`}>
            {v > p ? "▲" : "▼"} {Math.abs(v - p)}
            {unit} so với tuần trước đó
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <ReportShell tab="/bao-cao" title="Báo cáo toàn khóa">
      <p class="muted small">{props.learners} học viên thuộc 12 đội. Số liệu theo tuần (thứ Hai → Chủ nhật), tuần mới nhất ở trên.</p>
      <div class="tiles">
        {tile("Đi học offline (có mặt)", "attendance")}
        {tile("Bài ngày nộp đúng hạn", "dailyOnTime")}
        {tile("Bài tuần đã nộp", "weeklyDone")}
        {tile("Lượt chấm chéo (dh3g)", "feedbacks", "")}
      </div>
      <div class="scroll">
        <table class="rtable">
          <thead>
            <tr>
              <th>Tuần</th>
              <th>Đi học</th>
              <th>Bài ngày đúng hạn</th>
              <th>Bài ngày đã nộp</th>
              <th>Bài tuần đã nộp</th>
              <th class="r">Chấm chéo</th>
            </tr>
          </thead>
          <tbody>
            {props.weeks.map((w) => (
              <tr>
                <td>{ddmm(w.from)}</td>
                <td>
                  <Meter v={w.attendance} />
                </td>
                <td>
                  <Meter v={w.dailyOnTime} />
                </td>
                <td>
                  <Meter v={w.dailyDone} />
                </td>
                <td>
                  <Meter v={w.weeklyDone} />
                </td>
                <td class="r">{w.feedbacks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">
        "Đã nộp" gồm cả nộp trễ. Bài đang mở (chưa tới hạn) chưa tính. Chấm chéo: số lượt học viên nhận xét bài của nhau trên dh3g, tính theo ngày nhận xét.
      </p>
    </ReportShell>
  );
}

// ---------- Buổi học offline ----------
const ATT_ROWS: [keyof AttCounts, string][] = [
  ["present", "Có mặt (điểm danh)"],
  ["onTime", "· đúng giờ, đúng chỗ"],
  ["late", "· trễ giờ"],
  ["wrongPlace", "· sai vị trí"],
  ["noLoc", "· không có vị trí"],
  ["excused", "Nghỉ có phép"],
  ["absent", "Vắng không phép (kể cả học Zoom)"],
  ["pd", "PD (không tính)"],
];

function People(props: { title: string; list: { name: string; team: string; region: string }[] }) {
  if (!props.list.length) return null;
  return (
    <details class="card-item">
      <summary>
        <strong>
          {props.title} ({props.list.length})
        </strong>
      </summary>
      <ul class="plist">
        {props.list.map((p) => (
          <li>
            {p.name} <span class="muted small">· {teamLabel(p.team)} · đầu {p.region}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SessionReportPage(props: { r: SessionReport }) {
  const { r } = props;
  const hn = r.byRegion[0]!.c, sg = r.byRegion[1]!.c;
  const counted = (c: AttCounts) => c.total - c.pd;
  return (
    <ReportShell tab="/bao-cao/buoi-hoc" title="Báo cáo buổi học offline">
      {r.sessions.length === 0 ? (
        <p class="muted">Chưa có dữ liệu điểm danh offline.</p>
      ) : (
        <>
          <p class="chips-label">Chọn buổi (thứ Sáu)</p>
          <nav class="chips">
            {r.sessions.map((d) => (
              <a class={`chip${d === r.day ? " on" : ""}`} href={`/bao-cao/buoi-hoc?ngay=${d}`}>
                {ddmm(d)}
              </a>
            ))}
          </nav>
          <div class="tiles">
            <div class="tile">
              <div class="lbl">Có mặt · toàn khóa</div>
              <div class="num">
                {r.all.present}/{counted(r.all)}
              </div>
              <div class="small muted">{pct(r.all.present, counted(r.all))}%</div>
            </div>
            <div class="tile">
              <div class="lbl">Đầu Hà Nội</div>
              <div class="num">
                {hn.present}/{counted(hn)}
              </div>
              <div class="small muted">
                {pct(hn.present, counted(hn))}% · vắng {hn.absent}
              </div>
            </div>
            <div class="tile">
              <div class="lbl">Đầu Sài Gòn</div>
              <div class="num">
                {sg.present}/{counted(sg)}
              </div>
              <div class="small muted">
                {pct(sg.present, counted(sg))}% · vắng {sg.absent}
              </div>
            </div>
            <div class="tile">
              <div class="lbl">Trễ giờ</div>
              <div class="num">{r.all.late}</div>
              <div class="small muted">
                HN {hn.late} · SG {sg.late}
              </div>
            </div>
          </div>

          <h2>Chi tiết buổi {r.day ? ddmm(r.day) : ""}</h2>
          <div class="scroll">
            <table class="rtable">
              <thead>
                <tr>
                  <th />
                  <th class="r">Đầu HN</th>
                  <th class="r">Đầu SG</th>
                  <th class="r">Toàn khóa</th>
                </tr>
              </thead>
              <tbody>
                {ATT_ROWS.map(([k, label]) => (
                  <tr>
                    <td>{label}</td>
                    <td class="r">{hn[k]}</td>
                    <td class="r">{sg[k]}</td>
                    <td class="r">
                      <strong>{r.all[k]}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <People title="Vắng không phép" list={r.absent} />
          <People title="Nghỉ có phép" list={r.excused} />
          <People title="Trễ giờ" list={r.late} />

          <h2>Theo đội</h2>
          <Legend labels={["Có mặt", "Có phép", "Vắng"]} />
          <div class="scroll">
            <table class="rtable">
              <thead>
                <tr>
                  <th>Đội</th>
                  <th>Có mặt / có phép / vắng</th>
                  <th class="r">Có mặt</th>
                  <th class="r">Trễ</th>
                  <th class="r">Vắng</th>
                </tr>
              </thead>
              <tbody>
                {r.byTeam.map((t) => (
                  <tr>
                    <td>{teamLabel(t.team)}</td>
                    <td>
                      <Stack ok={t.c.present} mid={t.c.excused} bad={t.c.absent} labels={["có mặt", "có phép", "vắng"]} />
                    </td>
                    <td class="r">
                      {t.c.present}/{counted(t.c)}
                    </td>
                    <td class="r">{t.c.late}</td>
                    <td class="r">{t.c.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Tỷ lệ có mặt qua các buổi</h2>
          <div class="scroll">
            <table class="rtable">
              <thead>
                <tr>
                  <th>Buổi</th>
                  <th>Đầu HN</th>
                  <th>Đầu SG</th>
                  <th>Toàn khóa</th>
                </tr>
              </thead>
              <tbody>
                {r.trend
                  .slice()
                  .reverse()
                  .map((t) => (
                    <tr>
                      <td>{ddmm(t.day)}</td>
                      <td>
                        <Meter v={t.hn} />
                      </td>
                      <td>
                        <Meter v={t.sg} />
                      </td>
                      <td>
                        <Meter v={t.all} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p class="muted small">Đầu HN = khu vực Hà Nội, Miền Bắc; đầu SG = HCM, Miền Nam (theo cột "Khu Vực" của file điểm danh). Tỷ lệ không tính PD.</p>
        </>
      )}
    </ReportShell>
  );
}

// ---------- Bài tập ----------
function AssignmentTable(props: { lines: AssignmentLine[]; week?: boolean; exam?: boolean }) {
  return (
    <div class="scroll">
      <table class="rtable">
        <thead>
          <tr>
            <th>Bài</th>
            <th>Tình hình nộp</th>
            <th class="r">Đúng hạn</th>
            <th class="r">Trễ</th>
            <th class="r">Chưa nộp</th>
            {props.exam ? null : <th class="r">Video</th>}
            {props.exam ? null : <th class="r">Chấm chéo</th>}
            {props.week ? <th class="r">Đã chấm</th> : null}
            {props.week ? <th class="r">Chất lượng</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.lines.map((l) => (
            <tr>
              <td>
                <a href={`/nop-bai?bt=${l.id}`}>{l.title.replace(/\s*\(X10\)\s*/i, "").slice(0, 40)}</a>
                <div class="small muted">
                  hạn {shortVN(l.due)}
                  {l.open ? " · đang mở" : ""}
                </div>
              </td>
              <td>
                <Stack ok={l.onTime} mid={l.late} bad={l.open ? 0 : l.missing} />
              </td>
              <td class="r">
                {l.onTime} <span class="muted small">({pct(l.onTime, l.total)}%)</span>
              </td>
              <td class="r">{l.late}</td>
              <td class="r">{l.open ? "—" : l.missing}</td>
              {props.exam ? null : <td class="r">{l.videos}</td>}
              {props.exam ? null : <td class="r">{l.feedbacks}</td>}
              {props.week ? (
                <td class="r">
                  <a href={`/cham?bt=${l.id}`}>
                    {l.graded}/{l.onTime + l.late}
                  </a>
                </td>
              ) : null}
              {props.week ? <td class="r">{l.quality === null || l.quality === undefined ? "—" : `${l.quality.toLocaleString("vi-VN")}★`}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamTable(props: { lines: AssignmentLine[] }) {
  const teams = new Map<string, { onTime: number; late: number; missing: number; total: number }>();
  for (const l of props.lines)
    for (const t of l.byTeam) {
      const e = teams.get(t.team) ?? { onTime: 0, late: 0, missing: 0, total: 0 };
      e.onTime += t.onTime;
      e.late += t.late;
      e.missing += l.open ? 0 : t.missing;
      e.total += t.total;
      teams.set(t.team, e);
    }
  const rows = [...teams.entries()].sort((a, b) => pct(b[1].onTime, b[1].total) - pct(a[1].onTime, a[1].total));
  return (
    <div class="scroll">
      <table class="rtable">
        <thead>
          <tr>
            <th>Đội</th>
            <th>Tình hình nộp</th>
            <th class="r">Đúng hạn</th>
            <th class="r">Trễ</th>
            <th class="r">Chưa nộp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([team, e]) => (
            <tr>
              <td>{teamLabel(team)}</td>
              <td>
                <Stack ok={e.onTime} mid={e.late} bad={e.missing} />
              </td>
              <td class="r">{pct(e.onTime, e.total)}%</td>
              <td class="r">{e.late}</td>
              <td class="r">{e.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DailyReportPage(props: { weeks: string[]; week: string; lines: AssignmentLine[]; missing: { l: Learner; n: number }[] }) {
  return (
    <ReportShell tab="/bao-cao/bai-ngay" title="Báo cáo bài tập ngày">
      <p class="chips-label">Chọn tuần</p>
      <nav class="chips">
        {props.weeks.slice(0, 8).map((w) => (
          <a class={`chip${w === props.week ? " on" : ""}`} href={`/bao-cao/bai-ngay?tuan=${w}`}>
            {ddmm(w)}
          </a>
        ))}
      </nav>
      <Legend />
      {props.lines.length === 0 ? <p class="muted">Tuần này không có bài ngày.</p> : <AssignmentTable lines={props.lines} />}
      <h2>Theo đội (cả tuần)</h2>
      <TeamTable lines={props.lines} />
      <h2>Chưa nộp từ 3 bài trở lên trong tuần ({props.missing.length})</h2>
      {props.missing.length === 0 ? (
        <p class="muted small">Không có ai.</p>
      ) : (
        <ul class="plist card-item">
          {props.missing.map((m) => (
            <li>
              {m.l.name} <span class="muted small">· {teamLabel(m.l.team)} · chưa nộp {m.n} bài</span>
            </li>
          ))}
        </ul>
      )}
    </ReportShell>
  );
}

export function WeeklyReportPage(props: { lines: AssignmentLine[] }) {
  const latest = props.lines.filter((l) => !l.open).slice(0, 1);
  return (
    <ReportShell tab="/bao-cao/bai-tuan" title="Báo cáo bài tập tuần">
      <Legend />
      <AssignmentTable lines={props.lines} week />
      <p class="muted small">Đã chấm: số bài ban phụng sự / coach đã chấm trên số bài đã nộp. Chất lượng: điểm sao trung bình (thang 5).</p>
      {latest.length ? (
        <>
          <h2>Theo đội · {latest[0]!.title.replace(/\s*\(X10\)\s*/i, "")}</h2>
          <TeamTable lines={latest} />
        </>
      ) : null}
    </ReportShell>
  );
}

export function ExamReportPage(props: { lines: AssignmentLine[] }) {
  return (
    <ReportShell tab="/bao-cao/bai-thi" title="Báo cáo bài thi">
      {props.lines.length === 0 ? (
        <p class="muted">Chưa có bài thi.</p>
      ) : (
        <>
          <Legend />
          <AssignmentTable lines={props.lines} exam />
          <h2>Theo đội (mọi bài thi)</h2>
          <TeamTable lines={props.lines} />
          <p class="muted small">Bài thi chưa có tiêu chí chấm; báo cáo này chỉ thống kê nộp bài.</p>
        </>
      )}
    </ReportShell>
  );
}

// ---------- Chấm chéo ----------
function Names(props: { title: string; list: Learner[] }) {
  return (
    <details class="card-item">
      <summary>
        <strong>
          {props.title} ({props.list.length})
        </strong>
      </summary>
      {props.list.length ? (
        <ul class="plist">
          {props.list.map((l) => (
            <li>
              {l.name} <span class="muted small">· {teamLabel(l.team)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted small">Không có ai.</p>
      )}
    </details>
  );
}

export function PeerReportPage(props: { r: PeerReport }) {
  const { r } = props;
  const maxW = Math.max(1, ...r.byWeek.map((w) => w.n));
  return (
    <ReportShell tab="/bao-cao/cham-cheo" title="Báo cáo chấm chéo">
      <p class="muted small">Học viên nhận xét, chấm điểm bài của nhau trên dh3g (thang 0–100), tính từ 30/09/2026.</p>
      <div class="tiles">
        <div class="tile">
          <div class="lbl">Tổng lượt chấm chéo</div>
          <div class="num">{r.total.toLocaleString("vi-VN")}</div>
          <div class="small muted">TB {r.learners ? (r.total / r.learners).toFixed(1).replace(".", ",") : 0} lượt / học viên</div>
        </div>
        <div class="tile">
          <div class="lbl">Học viên có chấm chéo bài bạn</div>
          <div class="num">
            {r.givers}/{r.learners}
          </div>
          <div class="small muted">{pct(r.givers, r.learners)}%</div>
        </div>
        <div class="tile">
          <div class="lbl">Học viên được bạn chấm chéo</div>
          <div class="num">
            {r.receivers}/{r.learners}
          </div>
          <div class="small muted">{pct(r.receivers, r.learners)}%</div>
        </div>
        <div class="tile">
          <div class="lbl">Điểm chấm chéo TB</div>
          <div class="num">{r.avgGrade ?? "—"}</div>
          <div class="small muted">thang 100</div>
        </div>
      </div>

      <h2>Theo đội</h2>
      <div class="scroll">
        <table class="rtable">
          <thead>
            <tr>
              <th>Đội</th>
              <th>Thành viên có chấm</th>
              <th class="r">Lượt chấm (cho bạn khác)</th>
              <th class="r">Lượt được chấm</th>
              <th class="r">TB / người</th>
            </tr>
          </thead>
          <tbody>
            {r.byTeam.map((t) => (
              <tr>
                <td>{teamLabel(t.team)}</td>
                <td>
                  <Meter v={pct(t.activeGivers, t.members)} />
                </td>
                <td class="r">{t.given}</td>
                <td class="r">{t.received}</td>
                <td class="r">{t.members ? (t.given / t.members).toFixed(1).replace(".", ",") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Theo tuần</h2>
      <div class="scroll">
        <table class="rtable">
          <tbody>
            {r.byWeek.map((w) => (
              <tr>
                <td>Tuần {ddmm(w.from)}</td>
                <td style="width:70%">
                  <span class="hbar" style={`width:${Math.max(2, (100 * w.n) / maxW)}%`} />
                </td>
                <td class="r">{w.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Danh sách</h2>
      <details class="card-item" open>
        <summary>
          <strong>Chấm chéo nhiều nhất ({r.top.length})</strong>
        </summary>
        <ol class="plist">
          {r.top.map((t) => (
            <li>
              {t.l.name} <span class="muted small">· {teamLabel(t.l.team)} · {t.given} lượt</span>
            </li>
          ))}
        </ol>
      </details>
      <Names title="Chưa chấm chéo cho ai" list={r.never} />
      <Names title="Chưa được ai chấm chéo" list={r.notReceived} />
      <p class="muted small">Chấm chéo offline (file "NSKT2026 - CHẤM CHÉO BÀI TẬP") chưa đưa vào: cần chia sẻ quyền xem file cho tài khoản dịch vụ.</p>
    </ReportShell>
  );
}

// ---------- Từng học viên ----------
const SORTS: [string, string, (a: LearnerRow, b: LearnerRow) => number][] = [
  ["diem", "Điểm BXH", (a, b) => (b.percent ?? -1) - (a.percent ?? -1)],
  ["di-hoc", "Đi học", (a, b) => pct(b.attPresent, b.attTotal) - pct(a.attPresent, a.attTotal)],
  ["bai-ngay", "Bài ngày", (a, b) => pct(b.dailyOnTime, b.dailyTotal) - pct(a.dailyOnTime, a.dailyTotal)],
  ["bai-tuan", "Bài tuần", (a, b) => pct(b.weeklyDone, b.weeklyTotal) - pct(a.weeklyDone, a.weeklyTotal)],
  ["cham-cheo", "Chấm chéo", (a, b) => b.given - a.given],
  ["chat-luong", "Chất lượng", (a, b) => (b.quality ?? -1) - (a.quality ?? -1)],
  ["canh-bao", "Cảnh báo", (a, b) => b.flags - a.flags],
];

export function LearnerSummaryPage(props: { rows: LearnerRow[]; team: string; teams: string[]; sort: string; asc: boolean }) {
  const sorter = SORTS.find((x) => x[0] === props.sort) ?? SORTS[0]!;
  let rows = props.rows.filter((r) => !props.team || r.l.team === props.team).sort((a, b) => sorter[2](a, b) || a.l.name.localeCompare(b.l.name, "vi"));
  if (props.asc) rows = rows.reverse();
  const link = (o: { doi?: string; sx?: string; tang?: boolean }) => {
    const q = new URLSearchParams();
    const doi = o.doi ?? props.team;
    if (doi) q.set("doi", doi);
    q.set("sx", o.sx ?? props.sort);
    if (o.tang) q.set("tang", "1");
    return `/bao-cao/hoc-vien?${q}`;
  };
  const head = (key: string, label: string) => (
    <th class="r">
      <a href={link({ sx: key, tang: props.sort === key && !props.asc })} class={props.sort === key ? "on" : ""}>
        {label}
        {props.sort === key ? (props.asc ? " ▲" : " ▼") : ""}
      </a>
    </th>
  );
  const frac = (a: number, b: number) => (b ? `${pct(a, b)}%` : "—");
  return (
    <ReportShell tab="/bao-cao/hoc-vien" title="Tổng hợp từng học viên">
      <nav class="chips" aria-label="Lọc theo đội">
        <a class={`chip${props.team ? "" : " on"}`} href={link({ doi: "" })}>
          Toàn khóa
        </a>
        {props.teams.map((t) => (
          <a class={`chip${props.team === t ? " on" : ""}`} href={link({ doi: t })}>
            {teamLabel(t)}
          </a>
        ))}
      </nav>
      <p class="muted small">Bấm tên cột để sắp xếp (bấm lần nữa để đảo chiều). Dòng tô màu theo bảng xếp hạng. Bấm tên học viên để xem chi tiết.</p>
      <div class="scroll">
        <table class="rtable lsum">
          <thead>
            <tr>
              <th>Học viên</th>
              {head("diem", "Điểm BXH")}
              {head("di-hoc", "Đi học")}
              {head("bai-ngay", "Bài ngày đúng hạn")}
              {head("bai-tuan", "Bài tuần đã nộp")}
              {head("cham-cheo", "Chấm chéo cho / nhận")}
              {head("chat-luong", "Chất lượng")}
              {head("canh-bao", "Cảnh báo")}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr class={r.color ? `rk-${r.color}` : ""}>
                <td>
                  <a href={`/bang-xep-hang/hv/${r.l.id}`}>{r.l.name}</a>
                  <div class="small muted">{teamLabel(r.l.team)}</div>
                </td>
                <td class="r">
                  <strong>{r.percent === null ? "—" : `${r.percent.toLocaleString("vi-VN")}%`}</strong>
                </td>
                <td class="r">
                  {frac(r.attPresent, r.attTotal)} <span class="muted small">({r.attPresent}/{r.attTotal})</span>
                </td>
                <td class="r">
                  {frac(r.dailyOnTime, r.dailyTotal)} <span class="muted small">({r.dailyOnTime}/{r.dailyTotal})</span>
                </td>
                <td class="r">
                  {r.weeklyDone}/{r.weeklyTotal}
                </td>
                <td class="r">
                  {r.given} / {r.received}
                </td>
                <td class="r">{r.quality === null ? "—" : `${r.quality.toLocaleString("vi-VN")}★`}</td>
                <td class="r">{r.flags ? <span class="badge bad">{r.flags}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">
        Đi học: số buổi có mặt / số buổi có điểm danh (không tính PD). Bài ngày: nộp đúng hạn / số bài đã tới hạn. Cảnh báo: số bài có câu trả lời đối phó (xem ở trang Cảnh báo).
      </p>
    </ReportShell>
  );
}
