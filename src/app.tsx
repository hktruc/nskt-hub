import { COURSE, featureOfPath, featureOn } from "./course";
import { byWeek, journeyWeek, rankTeams, totals, type LearnerResult } from "./discipline/engine";
import { listExemptions, loadDiscipline, loadTeamReports, removeExemption, saveCamera, saveJournal, setExemption, setStopped } from "./discipline/data";
import { LeadersPage } from "./pages/leaders";
import { teamCodes } from "./domain/teams";
import { DisciplineHomePage, ExemptionsPage, HomeworkPage, LearnerPage, MembersPage, TeamPage, TeamsPage, ZoomPage, sessionName, type Viewer } from "./pages/discipline";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { authenticate } from "./auth";
import { addDays, vietnamDay } from "./dates";
import type { Env } from "./env";
import { Layout, WHO_SLOT, whoChip } from "./layout";
import { DataStatusPage, loadDataStatus } from "./pages/data-status";
import { SubmissionsPage, loadBoard } from "./pages/submissions";
import { loadOverview, OverviewPage } from "./pages/overview";
import { syncOfflineAttendance } from "./attendance/offline";
import { AccountPage, ActivatePage, ForbiddenPage, LoginPage, NeedLoginPage } from "./pages/account";
import { QueuePage, SheetPage } from "./pages/grading";
import { GradersPage } from "./pages/graders";
import { CourseReport, DailyReportPage, ExamReportPage, LearnerSummaryPage, PeerReportPage, SessionReportPage, WeeklyReportPage } from "./pages/reports";
import { assignmentReport, courseByWeek, learnerSummary, loadRoster, mondayOf, peerReport, sessionReport } from "./reports/data";
import { SCORING } from "./scoring/config";
import { loadGraderStats } from "./grading/stats";
import { FOCUS_OPTIONS, PROGRESS, SPIRIT } from "./grading/rubric";
import { allowedTeams, focusOf, gradableAssignments, loadQueue, loadSheet, saveReview, setFocus, validate, type SaveInput } from "./grading/store";
import { AdminPage, type IssuedCode } from "./pages/admin";
import {
  AccountError, cleanPhone, ROLE_LABEL, SESSION_COOKIE, SESSION_MAX_AGE, activate, canUseFullApp, changePassword, createUser, listUsers, login, logout,
  reissueCode, sessionUser, setActive, setRole, setTeams, userLabel, type User,
} from "./users/accounts";
import { LeaderboardPage, LearnerDetailPage, LearnerDetailView } from "./pages/leaderboard";
import { FlagsPage, loadFlags } from "./pages/flags";
import { SubmissionDetailPage, loadDetail } from "./pages/submission-detail";
import { loadLeaderboard, loadLearnerDetail } from "./scoring/leaderboard";
import { teamAwards } from "./scoring/team-awards";
import { nowVN, recomputeScores } from "./scoring/run";
import { DAYS_AHEAD, RECENT_DAYS_BACK, enqueueRange, planDaily, planFull, workQueue } from "./sync/queue";

type AppEnv = { Bindings: Env; Variables: { email: string; user: User } };
const app = new Hono<AppEnv>();

const sameOrigin = (c: Context<AppEnv>) => c.req.header("Origin") === new URL(c.req.url).origin;
const secureCookie = (c: Context<AppEnv>) => new URL(c.req.url).protocol === "https:";
function startSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: secureCookie(c), sameSite: "Lax", path: "/", maxAge: SESSION_MAX_AGE });
}
const safeNext = (n: string | undefined | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "");

// Không cần đăng nhập, không chứa dữ liệu.
app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// Bảng xếp hạng công khai (chủ dự án quyết định 11/11/2026): chỉ họ tên, đội, điểm, màu.
/** Trang công khai: người đã đăng nhập thì thấy đủ menu; người xem công khai thì không. */
async function publicViewer(c: Context<AppEnv>): Promise<"full" | "grader" | undefined> {
  const token = getCookie(c, SESSION_COOKIE);
  const u = token ? await sessionUser(c.env.DB, token, new Date()) : null;
  // Bản cho người đăng nhập không được lưu đệm chung với bản công khai.
  c.header("Cache-Control", u ? "private, no-store" : "public, max-age=300");
  c.header("Vary", "Cookie");
  return u ? (canUseFullApp(u) ? "full" : "grader") : undefined;
}

// Tắt bảng xếp hạng công khai: chỉ người đã đăng nhập xem được.
app.use("/bang-xep-hang/*", async (c, next) => {
  if (!featureOn("leaderboard")) return c.notFound();
  if (!featureOn("publicLeaderboard") && !(await publicViewer(c))) return c.html(<NeedLoginPage path={new URL(c.req.url).pathname} />, 401);
  await next();
});
app.use("/bang-xep-hang", async (c, next) => {
  if (!featureOn("leaderboard")) return c.notFound();
  if (!featureOn("publicLeaderboard") && !(await publicViewer(c))) return c.html(<NeedLoginPage path="/bang-xep-hang" />, 401);
  await next();
});

app.get("/bang-xep-hang", async (c) => {
  const data = await loadLeaderboard(c.env.DB, nowVN(new Date()));
  const teamMode = featureOn("teamBoard") && c.req.query("xem") === "doi";
  const awards = teamMode && featureOn("teamAwards") ? await teamAwards(c.env.DB, nowVN(new Date()), data.ranked) : [];
  const teams = [...new Set(data.ranked.map((r) => r.team))].sort();
  const doi = c.req.query("doi") ?? "";
  const viewerNav = await publicViewer(c);
  return c.html(
    <LeaderboardPage
      ranked={data.ranked}
      team={teams.includes(doi) ? doi : ""}
      teams={teams}
      provisional={data.provisional}
      hasAttendance={data.hasAttendance}
      updatedAt={data.updatedAt}
      origin={new URL(c.req.url).origin}
      viewerNav={viewerNav}
      mode={teamMode ? "doi" : "ca-nhan"}
      awards={awards}
    />,
  );
});

// Chi tiết một học viên trên bảng xếp hạng (công khai như bảng xếp hạng). `?p=1`: chỉ phần nội dung cho cửa sổ bật lên.
app.get("/bang-xep-hang/hv/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const d = Number.isSafeInteger(id) ? await loadLearnerDetail(c.env.DB, id, nowVN(new Date())) : null;
  if (!d) return c.text("Không tìm thấy học viên trên bảng xếp hạng.", 404);
  if (c.req.query("p")) {
    c.header("Cache-Control", "public, max-age=300");
    return c.html(<LearnerDetailView d={d} inDialog />);
  }
  return c.html(<LearnerDetailPage d={d} viewerNav={await publicViewer(c)} />);
});

// ---- Đăng nhập bằng số điện thoại (không cần đã đăng nhập) ----
app.get("/dang-nhap", (c) =>
  c.html(<LoginPage next={c.req.query("tiep")} notice={c.req.query("tb") === "da-xuat" ? "Đã đăng xuất." : undefined} />),
);

app.post("/dang-nhap", async (c) => {
  if (!sameOrigin(c)) return c.text("Yêu cầu không hợp lệ.", 403);
  const f = await c.req.formData();
  const phone = String(f.get("sdt") ?? "");
  const next = safeNext(String(f.get("tiep") ?? ""));
  try {
    const token = await login(c.env.DB, phone, String(f.get("mk") ?? ""), new Date());
    startSessionCookie(c, token);
    return c.redirect(next || "/", 303);
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return c.html(<LoginPage error={e.message} phone={phone} next={next} />, 401);
  }
});

app.get("/kich-hoat", (c) => c.html(<ActivatePage />));

app.post("/kich-hoat", async (c) => {
  if (!sameOrigin(c)) return c.text("Yêu cầu không hợp lệ.", 403);
  const f = await c.req.formData();
  const phone = String(f.get("sdt") ?? "");
  try {
    const token = await activate(
      c.env.DB,
      { phone, code: String(f.get("ma") ?? ""), password: String(f.get("mk") ?? ""), confirm: String(f.get("mk2") ?? "") },
      new Date(),
    );
    startSessionCookie(c, token);
    return c.redirect("/", 303);
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return c.html(<ActivatePage error={e.message} phone={phone} />, 400);
  }
});

app.post("/dang-xuat", async (c) => {
  if (!sameOrigin(c)) return c.text("Yêu cầu không hợp lệ.", 403);
  await logout(c.env.DB, getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/dang-nhap?tb=da-xuat", 303);
});

// ---- Mọi trang khác: phải đăng nhập (số điện thoại, hoặc Cloudflare Access cho admin) ----
const GRADER_PATHS = ["/cham", "/tai-khoan"];
const LEADER_PATHS = ["/ky-luat/nhom", "/ky-luat/zoom", "/ky-luat/hv", "/tai-khoan"];

app.use("*", async (c, next) => {
  // Thao tác ghi chỉ nhận từ chính trang của ứng dụng.
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && !sameOrigin(c)) {
    return c.text("Yêu cầu không hợp lệ.", 403);
  }
  const now = new Date();
  let user = await sessionUser(c.env.DB, getCookie(c, SESSION_COOKIE), now);
  if (!user) {
    const auth = await authenticate(c.req.raw, c.env);
    if (!auth.ok) {
      const path = new URL(c.req.url).pathname + new URL(c.req.url).search;
      return c.html(<NeedLoginPage path={path} />, auth.status);
    }
    // Người vào qua Cloudflare Access (chủ dự án) có quyền admin.
    user = { id: 0, name: auth.email, phone: "", role: "admin", teams: [], viaAccess: true };
  }
  const path = new URL(c.req.url).pathname;
  const leader = user.role === "truong_nhom";
  if (!canUseFullApp(user) && path === "/") return c.redirect(leader ? "/ky-luat/nhom" : "/cham", 303);
  const allowed = leader ? LEADER_PATHS : GRADER_PATHS;
  if (!canUseFullApp(user) && !allowed.some((p) => path === p || path.startsWith(`${p}/`))) {
    return c.html(
      <ForbiddenPage user={user} message={leader ? "Tài khoản trưởng nhóm chỉ xem nhóm của mình và báo cáo camera, nhật ký nhóm." : "Tài khoản ban phụng sự chỉ dùng bàn chấm bài."} />,
      403,
    );
  }
  if ((path === "/quan-tri" || path.startsWith("/quan-tri/")) && user.role !== "admin") {
    return c.html(<ForbiddenPage user={user} message="Chỉ admin mới vào được trang quản trị." />, 403);
  }
  const feature = featureOfPath(path);
  if (feature && !featureOn(feature)) return c.html(<ForbiddenPage user={user} message="Khóa học này không dùng tính năng này." />, 404);
  c.set("user", user);
  c.set("email", userLabel(user));
  await next();
  // Hiện tên + vai trò người đang đăng nhập ở đầu mọi trang nội bộ.
  if (c.res.headers.get("content-type")?.startsWith("text/html")) {
    const html = await c.res.text();
    if (html.includes(WHO_SLOT)) {
      const label = user.viaAccess ? "Admin (Cloudflare Access)" : ROLE_LABEL[user.role];
      c.res = new Response(html.replace(WHO_SLOT, whoChip(user.name, label)), c.res);
    } else c.res = new Response(html, c.res);
  }
});

// ---- Tài khoản của chính mình ----
app.get("/tai-khoan", (c) => c.html(<AccountPage user={c.get("user")} notice={c.req.query("tb") === "doi-mk" ? "Đã đổi mật khẩu." : undefined} />));

app.post("/tai-khoan/mat-khau", async (c) => {
  const u = c.get("user");
  if (u.viaAccess) return c.redirect("/tai-khoan", 303);
  const f = await c.req.formData();
  try {
    await changePassword(c.env.DB, u.id, { current: String(f.get("cu") ?? ""), password: String(f.get("mk") ?? ""), confirm: String(f.get("mk2") ?? "") });
    return c.redirect("/tai-khoan?tb=doi-mk", 303);
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return c.html(<AccountPage user={u} error={e.message} />, 400);
  }
});

// ---- Bàn chấm bài tuần ----
async function queueFor(c: Context<AppEnv>, bt?: string) {
  const u = c.get("user");
  const nowVNs = nowVN(new Date());
  const weeks = await gradableAssignments(c.env.DB, nowVNs);
  const week = weeks.find((w) => String(w.id) === bt) ?? weeks[0] ?? null;
  // Ban phụng sự: đội theo lịch giao của tuần có hạn nộp bài này.
  const allowed = week ? await allowedTeams(c.env.DB, u, week.due_at) : u.role === "phung_su" ? [] : null;
  const lines = week ? await loadQueue(c.env.DB, week, allowed, nowVNs, u.id) : [];
  const teams = allowed ?? [...new Set(lines.map((l) => l.team))].sort();
  return { u, weeks, week, lines, teams };
}

const GRADING_NOTICES: Record<string, string> = {
  "het-viec": "Đã lưu. Bạn đã chấm hết những bài đang chờ trong mục này.",
  "trong-tam": "Đã đổi trọng tâm tuần.",
};

app.get("/cham", async (c) => {
  const { u, weeks, week, lines, teams } = await queueFor(c, c.req.query("bt"));
  const doi = c.req.query("doi") ?? "";
  return c.html(
    <QueuePage
      nowVN={nowVN(new Date())}
      user={u}
      weeks={weeks}
      week={week}
      teams={teams}
      team={teams.includes(doi) ? doi : ""}
      filter={c.req.query("loc") ?? ""}
      lines={lines}
      focus={week ? await focusOf(c.env.DB, week.id) : ""}
      notice={GRADING_NOTICES[c.req.query("tb") ?? ""]}
    />,
  );
});

async function sheetFor(c: Context<AppEnv>, hv: number, bt: number) {
  if (!Number.isSafeInteger(hv) || !Number.isSafeInteger(bt)) return null;
  const s = await loadSheet(c.env.DB, hv, bt, c.get("user").id);
  if (!s) return null;
  const allowed = await allowedTeams(c.env.DB, c.get("user"), s.assignment.due_at);
  if (allowed && !allowed.includes(s.learner.team)) return "cam" as const;
  return s;
}
const sheetBack = (bt: number, team: string) => `/cham?bt=${bt}&doi=${team}`;

app.get("/cham/bai", async (c) => {
  const s = await sheetFor(c, Number(c.req.query("hv")), Number(c.req.query("bt")));
  if (s === "cam") return c.html(<ForbiddenPage user={c.get("user")} message="Đội này chưa được giao cho bạn chấm." />, 403);
  if (!s) return c.notFound();
  return c.html(<SheetPage user={c.get("user")} s={s} back={sheetBack(s.assignment.id, s.learner.team)} notice={c.req.query("tb") === "da-luu" ? "Đã lưu." : undefined} />);
});

app.post("/cham/luu", async (c) => {
  const f = await c.req.formData();
  const draft: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") draft[k] = v;
  const s = await sheetFor(c, Number(draft.hv), Number(draft.bt));
  if (s === "cam") return c.html(<ForbiddenPage user={c.get("user")} message="Đội này chưa được giao cho bạn chấm." />, 403);
  if (!s) return c.notFound();
  const n = (k: string) => (draft[k] ? Number(draft[k]) : null);
  const input: SaveInput = {
    items: s.items.map((it, i) => ({
      key: it.key,
      kind: it.kind,
      a1: n(`a1_${i}`), a2: n(`a2_${i}`), a3: n(`a3_${i}`), a4: n(`a4_${i}`), a5: n(`a5_${i}`),
      flag: draft[`f_${i}`] && draft[`k${i}`] === it.key ? draft[`f_${i}`]! : null,
    })),
    b1: n("b1"),
    b2: n("b2"),
    spirit: draft.spirit && draft.spirit in SPIRIT ? draft.spirit : null,
    progress: draft.progress && draft.progress in PROGRESS ? draft.progress : null,
    comment: (draft.comment ?? "").slice(0, 2000),
    featured: draft.featured || null,
  };
  // Thẻ trong form phải khớp bài nộp hiện tại (học viên có thể vừa sửa bài).
  if (s.items.some((it, i) => draft[`k${i}`] !== it.key)) {
    return c.html(<SheetPage user={c.get("user")} s={s} back={sheetBack(s.assignment.id, s.learner.team)} error="Bài nộp vừa thay đổi trong lúc bạn chấm. Trang đã tải lại bản mới, nhờ bạn chấm lại." />, 409);
  }
  const err = validate(input);
  if (err) return c.html(<SheetPage user={c.get("user")} s={s} draft={draft} error={err} back={sheetBack(s.assignment.id, s.learner.team)} />, 400);
  await saveReview(c.env.DB, s, input, c.get("user"), c.get("email"), new Date());
  // Sang người tiếp theo CHƯA AI CHẤM (ưu tiên cùng đội); hết thì tới bài mình đã chấm nhưng học viên vừa sửa.
  const week = { id: s.assignment.id, title: s.assignment.title, type: s.assignment.type, due_at: s.assignment.due_at };
  const u = c.get("user");
  const lines = await loadQueue(c.env.DB, week, await allowedTeams(c.env.DB, u, week.due_at), nowVN(new Date()), u.id);
  const others = lines.filter((l) => l.learnerId !== s.learner.id);
  const fresh = others.filter((l) => l.status === "chua-cham");
  const todo = fresh.length ? fresh : others.filter((l) => l.status === "sua-sau-cham" && l.mine);
  const next = todo.find((l) => l.team === s.learner.team) ?? todo[0];
  return c.redirect(next ? `/cham/bai?hv=${next.learnerId}&bt=${s.assignment.id}` : `/cham?bt=${s.assignment.id}&tb=het-viec`, 303);
});

app.get("/cham/nguoi-cham", (c) => c.redirect("/bao-cao/nguoi-cham", 301));

// ---- Báo cáo thống kê (coach, BTC, admin) ----
app.get("/bao-cao", async (c) => {
  const [weeks, roster] = await Promise.all([courseByWeek(c.env.DB), loadRoster(c.env.DB)]);
  return c.html(<CourseReport weeks={weeks} learners={roster.length} />);
});
app.get("/bao-cao/buoi-hoc", async (c) => c.html(<SessionReportPage r={await sessionReport(c.env.DB, c.req.query("ngay"))} />));
app.get("/bao-cao/bai-ngay", async (c) => {
  const today = vietnamDay(new Date());
  const weeks: string[] = [];
  for (let w = mondayOf(today); w >= mondayOf(SCORING.startDate); w = addDays(w, -7)) weeks.push(w);
  const week = weeks.includes(c.req.query("tuan") ?? "") ? c.req.query("tuan")! : weeks[0]!;
  const [{ lines, perLearner }, roster] = await Promise.all([
    assignmentReport(c.env.DB, "NORMAL", { from: week, to: addDays(week, 6) }),
    loadRoster(c.env.DB),
  ]);
  const missing = roster
    .map((l) => ({ l, n: perLearner.get(l.id)?.missing ?? 0 }))
    .filter((m) => m.n >= 3)
    .sort((a, b) => b.n - a.n);
  return c.html(<DailyReportPage weeks={weeks} week={week} lines={lines} missing={missing} />);
});
app.get("/bao-cao/bai-tuan", async (c) => c.html(<WeeklyReportPage lines={(await assignmentReport(c.env.DB, "WEEK")).lines} />));
app.get("/bao-cao/cham-cheo", async (c) => c.html(<PeerReportPage r={await peerReport(c.env.DB)} />));
app.get("/bao-cao/hoc-vien", async (c) => {
  const now = nowVN(new Date());
  const [lb, peer] = await Promise.all([loadLeaderboard(c.env.DB, now), peerReport(c.env.DB)]);
  const rows = await learnerSummary(c.env.DB, now, lb.ranked, peer);
  const teams = [...new Set(rows.map((r) => r.l.team))].sort();
  const doi = c.req.query("doi") ?? "";
  return c.html(<LearnerSummaryPage rows={rows} team={teams.includes(doi) ? doi : ""} teams={teams} sort={c.req.query("sx") ?? "diem"} asc={c.req.query("tang") === "1"} />);
});
app.get("/bao-cao/bai-thi", async (c) => c.html(<ExamReportPage lines={(await assignmentReport(c.env.DB, "EXAM")).lines} />));

app.get("/bao-cao/nguoi-cham", async (c) => {
  const u = c.get("user");
  if (u.role === "phung_su") return c.html(<ForbiddenPage user={u} message="Trang này dành cho coach, BTC, admin." />, 403);
  const { graders, overall } = await loadGraderStats(c.env.DB);
  // Đội được giao tuần này (theo lịch giao luân phiên).
  const teamsOf = new Map<number, string[]>((await listUsers(c.env.DB)).map((x) => [x.id, x.teams]));
  return c.html(<GradersPage graders={graders} overall={overall} teamsOf={teamsOf} />);
});

app.post("/cham/trong-tam", async (c) => {
  const u = c.get("user");
  if (u.role === "phung_su") return c.html(<ForbiddenPage user={u} message="Chỉ coach, BTC, admin đổi được trọng tâm tuần." />, 403);
  const f = await c.req.formData();
  const bt = Number(f.get("bt"));
  const tt = String(f.get("tt") ?? "");
  if (!Number.isSafeInteger(bt) || !FOCUS_OPTIONS.includes(tt)) return c.text("Yêu cầu không hợp lệ.", 400);
  await setFocus(c.env.DB, bt, tt, c.get("email"), new Date());
  return c.redirect(`/cham?bt=${bt}&tb=trong-tam`, 303);
});

// ---- Quản trị (chỉ admin) ----
async function adminPage(c: Context<AppEnv>, extra: { issued?: IssuedCode; error?: string; notice?: string } = {}, status: 200 | 400 = 200) {
  return c.html(<AdminPage users={await listUsers(c.env.DB)} origin={new URL(c.req.url).origin} {...extra} />, status);
}
const ADMIN_NOTICES: Record<string, string> = {
  doi: "Đã lưu đội được giao.",
  "thu-hoi": "Đã thu hồi quyền và đăng xuất người đó khỏi mọi máy.",
  "khoi-phuc": "Đã khôi phục quyền.",
  "vai-tro": "Đã đổi vai trò.",
};

app.get("/quan-tri", (c) => adminPage(c, { notice: ADMIN_NOTICES[c.req.query("tb") ?? ""] }));

app.post("/quan-tri/tao", async (c) => {
  const f = await c.req.formData();
  const input = { phone: String(f.get("sdt") ?? ""), name: String(f.get("ten") ?? ""), role: String(f.get("vt") ?? "") };
  try {
    const code = await createUser(c.env.DB, input, c.get("email"), new Date());
    return adminPage(c, { issued: { name: input.name.trim(), phone: input.phone, code } });
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return adminPage(c, { error: e.message }, 400);
  }
});

async function targetUser(c: Context<AppEnv>, f: FormData) {
  const id = Number(f.get("id"));
  return Number.isSafeInteger(id) ? c.env.DB.prepare("SELECT id, name, phone FROM users WHERE id = ?").bind(id).first<{ id: number; name: string; phone: string }>() : null;
}

app.post("/quan-tri/ma", async (c) => {
  const f = await c.req.formData();
  const u = await targetUser(c, f);
  if (!u) return adminPage(c, { error: "Không tìm thấy người này." }, 400);
  const code = await reissueCode(c.env.DB, u.id, new Date());
  return adminPage(c, { issued: { name: u.name, phone: u.phone, code } });
});

app.post("/quan-tri/trang-thai", async (c) => {
  const f = await c.req.formData();
  const u = await targetUser(c, f);
  if (!u) return adminPage(c, { error: "Không tìm thấy người này." }, 400);
  const on = f.get("bat") === "1";
  await setActive(c.env.DB, u.id, on);
  return c.redirect(`/quan-tri?tb=${on ? "khoi-phuc" : "thu-hoi"}`, 303);
});

app.post("/quan-tri/vai-tro", async (c) => {
  const f = await c.req.formData();
  const u = await targetUser(c, f);
  if (!u) return adminPage(c, { error: "Không tìm thấy người này." }, 400);
  try {
    await setRole(c.env.DB, u.id, String(f.get("vt") ?? ""));
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return adminPage(c, { error: e.message }, 400);
  }
  return c.redirect("/quan-tri?tb=vai-tro", 303);
});

app.post("/quan-tri/doi", async (c) => {
  const f = await c.req.formData();
  const u = await targetUser(c, f);
  if (!u) return adminPage(c, { error: "Không tìm thấy người này." }, 400);
  const tuan = String(f.get("tuan") ?? "");
  await setTeams(c.env.DB, u.id, f.getAll("doi").map(String), c.get("email"), new Date(), /^\d{4}-\d{2}-\d{2}$/.test(tuan) ? tuan : undefined);
  return c.redirect("/quan-tri?tb=doi", 303);
});

app.get("/", async (c) => (COURSE.home === "discipline" ? disciplineHome(c) : c.html(<OverviewPage o={await loadOverview(c.env)} />)));

// ---- Kỷ luật: lỗi nhẹ / lỗi nặng (Zoom, bài tập), nhóm & trưởng nhóm, duyệt miễn ----
const viewerOf = (u: User): Viewer => (canUseFullApp(u) ? { full: true, teams: null, nav: "full" } : { full: false, teams: u.teams, nav: "leader" });
const canSeeTeam = (v: Viewer, team: string) => v.teams === null || v.teams.includes(team);
const currentWeekNow = () => journeyWeek(COURSE.discipline, nowVN(new Date()));
const DISC_NOTICES: Record<string, string> = {
  camera: "Đã lưu báo cáo camera.",
  "nhat-ky": "Đã lưu nhật ký nhóm.",
  mien: "Đã duyệt miễn. Mục này không còn tính lỗi.",
  "bo-mien": "Đã bỏ miễn.",
  dung: "Đã lưu trạng thái tham gia.",
};

function zoomSummary(results: LearnerResult[], sessionId: number) {
  const zs = results.map((r) => r.zoom.find((z) => z.s.id === sessionId)).filter((z) => z !== undefined);
  const n = (st: string) => zs.filter((z) => z.state === st).length;
  return { onTime: n("dung-gio"), late: n("tre"), absent: n("vang"), exempt: n("mien"), cameraOff: zs.filter((z) => z.cameraOff).length, past: zs.some((z) => z.state !== "chua-dien-ra" && z.state !== "dung") };
}

async function disciplineHome(c: Context<AppEnv>) {
  const now = new Date();
  const [{ input, results }, journals, sync] = await Promise.all([
    loadDiscipline(c.env.DB, now),
    loadTeamReports(c.env.DB, "journal"),
    c.env.DB.prepare("SELECT MAX(finished_at) AS at FROM sync_jobs WHERE status = 'done'").first<{ at: string | null }>(),
  ]);
  const week = currentWeekNow();
  const past = [...input.sessions].filter((s) => zoomSummary(results, s.id).past).sort((a, b) => b.startAt.localeCompare(a.startAt));
  const last = past[0];
  return c.html(
    <DisciplineHomePage
      v={viewerOf(c.get("user"))}
      t={totals(results)}
      weeks={byWeek(results, COURSE.discipline)}
      teams={rankTeams(results)}
      currentWeek={week}
      journals={new Set(journals.filter((j) => j.ref === String(week)).map((j) => j.team))}
      lastSession={last ? { s: last, ...zoomSummary(results, last.id) } : null}
      updatedAt={sync?.at ?? null}
    />,
  );
}

app.get("/ky-luat", (c) => c.redirect("/", 301));

app.get("/ky-luat/zoom", async (c) => {
  const v = viewerOf(c.get("user"));
  const [{ input, results }, cameraReports] = await Promise.all([loadDiscipline(c.env.DB, new Date()), loadTeamReports(c.env.DB, "camera")]);
  const sessions = [...input.sessions].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const sums = sessions.map((s) => ({ s, ...zoomSummary(results, s.id) }));
  const wanted = Number(c.req.query("buoi"));
  const selected = sessions.find((s) => s.id === wanted) ?? [...sums].reverse().find((x) => x.past)?.s ?? null;
  return c.html(
    <ZoomPage
      v={v}
      sessions={sums}
      selected={selected}
      results={results.filter((r) => v.full || canSeeTeam(v, r.l.team))}
      cameraReports={cameraReports}
      notice={DISC_NOTICES[c.req.query("tb") ?? ""]}
    />,
  );
});

app.post("/ky-luat/zoom/camera", async (c) => {
  const u = c.get("user");
  const v = viewerOf(u);
  const f = await c.req.formData();
  const sessionId = Number(f.get("buoi"));
  const team = String(f.get("doi") ?? "");
  if (!canSeeTeam(v, team)) return c.text("Không được báo cáo cho nhóm này.", 403);
  const { results } = await loadDiscipline(c.env.DB, new Date());
  const members = results.filter((r) => r.l.team === team).map((r) => r.l.id);
  if (!members.length || !Number.isSafeInteger(sessionId)) return c.text("Dữ liệu không hợp lệ.", 400);
  await saveCamera(c.env.DB, sessionId, team, members, f.getAll("tat").map(Number), c.get("email"), new Date());
  return c.redirect(`/ky-luat/zoom?buoi=${sessionId}&tb=camera`, 303);
});

app.get("/ky-luat/bai-tap", async (c) => {
  const { input, results } = await loadDiscipline(c.env.DB, new Date());
  const assignments = [...input.assignments].filter((a) => a.dueAt >= COURSE.discipline.startDate).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const wanted = Number(c.req.query("bt"));
  const selected = assignments.find((a) => a.id === wanted) ?? [...assignments].reverse().find((a) => a.dueAt <= input.now) ?? null;
  return c.html(<HomeworkPage v={viewerOf(c.get("user"))} assignments={assignments} results={results} selected={selected} now={input.now} />);
});

app.get("/ky-luat/thanh-vien", async (c) => {
  const { results } = await loadDiscipline(c.env.DB, new Date());
  return c.html(<MembersPage v={viewerOf(c.get("user"))} results={results} sort={c.req.query("xep") ?? "loi"} />);
});

app.get("/ky-luat/nhom", async (c) => {
  const v = viewerOf(c.get("user"));
  if (!v.full) return v.teams?.[0] ? c.redirect(`/ky-luat/nhom/${v.teams[0]}`, 303) : c.html(<ForbiddenPage user={c.get("user")} message="Tài khoản chưa được giao nhóm. Nhờ admin giao nhóm ở trang Quản trị." />, 403);
  const [{ results }, journals] = await Promise.all([loadDiscipline(c.env.DB, new Date()), loadTeamReports(c.env.DB, "journal")]);
  const week = currentWeekNow();
  return c.html(<TeamsPage v={v} teams={rankTeams(results)} currentWeek={week} journals={new Set(journals.filter((j) => j.ref === String(week)).map((j) => j.team))} />);
});

app.get("/ky-luat/nhom/:team", async (c) => {
  const v = viewerOf(c.get("user"));
  const team = c.req.param("team");
  if (!canSeeTeam(v, team)) return c.html(<ForbiddenPage user={c.get("user")} message="Trưởng nhóm chỉ xem được nhóm của mình." />, 403);
  const [{ input, results }, reports] = await Promise.all([loadDiscipline(c.env.DB, new Date()), loadTeamReports(c.env.DB)]);
  const t = rankTeams(results).find((x) => x.team === team);
  if (!t) return c.notFound();
  const current = currentWeekNow();
  const w = Number(c.req.query("tuan"));
  const week = Number.isInteger(w) && w >= 1 && w <= COURSE.discipline.weeks ? w : current;
  const mine = reports.filter((r) => r.team === team);
  return c.html(
    <TeamPage
      v={v}
      team={team}
      t={t}
      results={results.filter((r) => r.l.team === team)}
      sessions={[...input.sessions].sort((a, b) => a.startAt.localeCompare(b.startAt))}
      cameraReports={mine.filter((r) => r.kind === "camera")}
      journals={mine.filter((r) => r.kind === "journal")}
      week={week}
      currentWeek={current}
      canWrite={true}
      notice={DISC_NOTICES[c.req.query("tb") ?? ""]}
    />,
  );
});

app.post("/ky-luat/nhom/:team/nhat-ky", async (c) => {
  const v = viewerOf(c.get("user"));
  const team = c.req.param("team");
  if (!canSeeTeam(v, team)) return c.text("Không được viết nhật ký cho nhóm này.", 403);
  const f = await c.req.formData();
  const week = Number(f.get("tuan"));
  if (!Number.isInteger(week) || week < 1 || week > COURSE.discipline.weeks) return c.text("Tuần không hợp lệ.", 400);
  const content = Object.fromEntries(COURSE.discipline.journalFields.map((x) => [x.key, String(f.get(x.key) ?? "")]));
  await saveJournal(c.env.DB, team, week, content, c.get("email"), new Date());
  return c.redirect(`/ky-luat/nhom/${team}?tuan=${week}&tb=nhat-ky#nhat-ky`, 303);
});

app.get("/ky-luat/hv/:id", async (c) => {
  const v = viewerOf(c.get("user"));
  const { results } = await loadDiscipline(c.env.DB, new Date());
  const r = results.find((x) => x.l.id === Number(c.req.param("id")));
  if (!r) return c.notFound();
  if (!canSeeTeam(v, r.l.team)) return c.html(<ForbiddenPage user={c.get("user")} message="Trưởng nhóm chỉ xem được thành viên nhóm mình." />, 403);
  return c.html(<LearnerPage v={v} r={r} notice={DISC_NOTICES[c.req.query("tb") ?? ""]} today={vietnamDay(new Date())} />);
});

app.post("/ky-luat/hv/:id/mien", async (c) => {
  if (!canUseFullApp(c.get("user"))) return c.text("Chỉ BTC được duyệt miễn.", 403);
  const id = Number(c.req.param("id"));
  const f = await c.req.formData();
  const kind = f.get("loai") === "zoom" ? "zoom" : "bai";
  const ref = Number(f.get("ma"));
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(ref)) return c.text("Dữ liệu không hợp lệ.", 400);
  if (f.get("bo") === "1") {
    await removeExemption(c.env.DB, id, kind, ref);
    return c.redirect(`/ky-luat/hv/${id}?tb=bo-mien`, 303);
  }
  const reason = String(f.get("ly_do") ?? "").trim();
  if (!reason) return c.text("Cần ghi lý do miễn.", 400);
  await setExemption(c.env.DB, id, kind, ref, reason, c.get("email"), new Date());
  return c.redirect(`/ky-luat/hv/${id}?tb=mien`, 303);
});

app.post("/ky-luat/hv/:id/dung", async (c) => {
  if (!canUseFullApp(c.get("user"))) return c.text("Chỉ BTC được đổi trạng thái tham gia.", 403);
  const id = Number(c.req.param("id"));
  const f = await c.req.formData();
  const from = f.get("bo") === "1" ? null : String(f.get("tu") ?? "");
  if (from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return c.text("Ngày không hợp lệ.", 400);
  await setStopped(c.env.DB, id, from, String(f.get("ly_do") ?? ""), c.get("email"), new Date());
  return c.redirect(`/ky-luat/hv/${id}?tb=dung`, 303);
});

// ---- BTC quản lý tài khoản trưởng nhóm (chỉ vai trò trưởng nhóm) ----
const LEADER_NOTICES: Record<string, string> = {
  doi: "Đã đổi nhóm phụ trách.",
  "thu-hoi": "Đã thu hồi quyền và đăng xuất trưởng nhóm khỏi mọi máy.",
  "khoi-phuc": "Đã khôi phục quyền.",
};
const LEADER_FROM = mondayOf(COURSE.discipline.startDate);
async function leadersPage(c: Context<AppEnv>, extra: { issued?: IssuedCode; error?: string; notice?: string } = {}, status: 200 | 400 = 200) {
  const leaders = (await listUsers(c.env.DB)).filter((u) => u.role === "truong_nhom");
  return c.html(<LeadersPage v={viewerOf(c.get("user"))} leaders={leaders} origin={new URL(c.req.url).origin} {...extra} />, status);
}
async function targetLeader(c: Context<AppEnv>, f: FormData) {
  const id = Number(f.get("id"));
  return Number.isSafeInteger(id)
    ? c.env.DB.prepare("SELECT id, name, phone FROM users WHERE id = ? AND role = 'truong_nhom'").bind(id).first<{ id: number; name: string; phone: string }>()
    : null;
}
const validTeam = (t: string) => teamCodes().includes(t);

app.use("/ky-luat/truong-nhom/*", async (c, next) => {
  if (!canUseFullApp(c.get("user"))) return c.html(<ForbiddenPage user={c.get("user")} message="Chỉ BTC, coach, admin quản lý tài khoản trưởng nhóm." />, 403);
  await next();
});
app.get("/ky-luat/truong-nhom", async (c) => {
  if (!canUseFullApp(c.get("user"))) return c.html(<ForbiddenPage user={c.get("user")} message="Chỉ BTC, coach, admin quản lý tài khoản trưởng nhóm." />, 403);
  return leadersPage(c, { notice: LEADER_NOTICES[c.req.query("tb") ?? ""] });
});
app.post("/ky-luat/truong-nhom/tao", async (c) => {
  const f = await c.req.formData();
  const team = String(f.get("doi") ?? "");
  const input = { phone: String(f.get("sdt") ?? ""), name: String(f.get("ten") ?? ""), role: "truong_nhom" };
  if (!validTeam(team)) return leadersPage(c, { error: "Cần chọn nhóm phụ trách." }, 400);
  try {
    const code = await createUser(c.env.DB, input, c.get("email"), new Date());
    const id = (await c.env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(cleanPhone(input.phone)).first<{ id: number }>())!.id;
    await setTeams(c.env.DB, id, [team], c.get("email"), new Date(), LEADER_FROM);
    return leadersPage(c, { issued: { name: input.name.trim(), phone: input.phone, code } });
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    return leadersPage(c, { error: e.message }, 400);
  }
});
app.post("/ky-luat/truong-nhom/ma", async (c) => {
  const u = await targetLeader(c, await c.req.formData());
  if (!u) return leadersPage(c, { error: "Không tìm thấy trưởng nhóm này." }, 400);
  return leadersPage(c, { issued: { name: u.name, phone: u.phone, code: await reissueCode(c.env.DB, u.id, new Date()) } });
});
app.post("/ky-luat/truong-nhom/trang-thai", async (c) => {
  const f = await c.req.formData();
  const u = await targetLeader(c, f);
  if (!u) return leadersPage(c, { error: "Không tìm thấy trưởng nhóm này." }, 400);
  const on = f.get("bat") === "1";
  await setActive(c.env.DB, u.id, on);
  return c.redirect(`/ky-luat/truong-nhom?tb=${on ? "khoi-phuc" : "thu-hoi"}`, 303);
});
app.post("/ky-luat/truong-nhom/doi", async (c) => {
  const f = await c.req.formData();
  const u = await targetLeader(c, f);
  const team = String(f.get("doi") ?? "");
  if (!u || !validTeam(team)) return leadersPage(c, { error: "Cần chọn trưởng nhóm và nhóm hợp lệ." }, 400);
  await setTeams(c.env.DB, u.id, [team], c.get("email"), new Date(), LEADER_FROM);
  return c.redirect("/ky-luat/truong-nhom?tb=doi", 303);
});

app.get("/ky-luat/mien", async (c) => {
  if (!canUseFullApp(c.get("user"))) return c.html(<ForbiddenPage user={c.get("user")} message="Chỉ BTC xem được trang này." />, 403);
  const [{ input, results }, exemptions] = await Promise.all([loadDiscipline(c.env.DB, new Date()), listExemptions(c.env.DB)]);
  const titles = new Map<string, string>([
    ...input.assignments.map((a) => [`bai:${a.id}`, a.title] as [string, string]),
    ...[...input.sessions].sort((a, b) => a.startAt.localeCompare(b.startAt)).map((s, i) => [`zoom:${s.id}`, `Zoom ${sessionName(s, i)}`] as [string, string]),
  ]);
  return c.html(<ExemptionsPage v={viewerOf(c.get("user"))} exemptions={exemptions} results={results} titles={titles} />);
});

const NOTICES: Record<string, string> = {
  "da-xep": "Đã xếp việc vào hàng đợi. Dữ liệu sẽ về dần; tải lại trang này sau vài phút.",
  "khong-co-gi-moi": "Các khoảng ngày này đã nằm sẵn trong hàng đợi, không cần xếp thêm.",
};

app.get("/nop-bai", async (c) => {
  const data = await loadBoard(c.env, { bt: c.req.query("bt"), doi: c.req.query("doi"), tt: c.req.query("tt") });
  return c.html(<SubmissionsPage data={data} />);
});

const DETAIL_NOTICES: Record<string, string> = {
  "da-sua": "Đã lưu điểm sửa tay. Bảng xếp hạng sẽ cập nhật trong vài phút.",
  "da-bo": "Đã bỏ điểm sửa tay, câu này quay về điểm tự động.",
  "sai-so": "Điểm không hợp lệ. Gõ một con số (ví dụ 2 hoặc 1,5), hoặc chữ \"bo\" để bỏ điểm sửa tay.",
};

app.get("/bai", async (c) => {
  const d = await loadDetail(c.env.DB, Number(c.req.query("hv")), Number(c.req.query("bt")));
  if (!d) return c.notFound();
  return c.html(<SubmissionDetailPage data={d} notice={DETAIL_NOTICES[c.req.query("tb") ?? ""]} />);
});

app.post("/bai/sua", async (c) => {
  const f = await c.req.formData();
  const hv = Number(f.get("hv"));
  const bt = Number(f.get("bt"));
  const cau = Number(f.get("cau"));
  if (![hv, bt, cau].every(Number.isSafeInteger)) return c.text("Yêu cầu không hợp lệ.", 400);
  const raw = String(f.get("diem") ?? "").trim().toLowerCase().replace(",", ".");
  const back = (tb: string) => c.redirect(`/bai?hv=${hv}&bt=${bt}&tb=${tb}#p${cau}`, 303);
  const now = new Date();
  if (raw === "bo" || raw === "bỏ") {
    await c.env.DB.prepare("DELETE FROM score_overrides WHERE learner_id=? AND assignment_id=? AND question_index=?").bind(hv, bt, cau).run();
    await recomputeScores(c.env.DB, now, { learnerId: hv, assignmentId: bt });
    return back("da-bo");
  }
  const earned = Number(raw);
  if (raw === "" || !Number.isFinite(earned) || earned < 0 || earned > 100) return back("sai-so");
  await c.env.DB.prepare(
    `INSERT INTO score_overrides (learner_id, assignment_id, question_index, earned, note, by_email, at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(learner_id, assignment_id, question_index) DO UPDATE SET earned=excluded.earned, by_email=excluded.by_email, at=excluded.at`,
  )
    .bind(hv, bt, cau, earned, null, c.get("email"), now.toISOString())
    .run();
  await recomputeScores(c.env.DB, now, { learnerId: hv, assignmentId: bt });
  return back("da-sua");
});

app.get("/canh-bao", async (c) => {
  const doi = c.req.query("doi") ?? "";
  const data = await loadFlags(c.env.DB, doi);
  return c.html(<FlagsPage lines={data.lines} teams={data.teams} team={data.teams.includes(doi) ? doi : ""} />);
});

app.get("/du-lieu", async (c) => {
  const status = await loadDataStatus(c.env);
  return c.html(
    <DataStatusPage status={status} notice={NOTICES[c.req.query("tb") ?? ""] ?? SHEET_NOTICES[c.req.query("dd") ?? ""]} />,
  );
});

app.post("/du-lieu/dong-bo", async (c) => {
  const form = await c.req.formData();
  const now = new Date();
  let added: number;
  if (form.get("pham-vi") === "toan-bo") {
    added = await planFull(c.env, now);
  } else {
    const today = vietnamDay(now);
    const from = addDays(today, -RECENT_DAYS_BACK);
    added = await enqueueRange(
      c.env.DB,
      from < c.env.SYNC_START_DATE ? c.env.SYNC_START_DATE : from,
      addDays(today, DAYS_AHEAD),
      "manual",
      now,
    );
  }
  return c.redirect(`/du-lieu?tb=${added > 0 ? "da-xep" : "khong-co-gi-moi"}`, 303);
});

const SHEET_NOTICES: Record<string, string> = {
  ok: "Đã đọc lại điểm danh offline từ Google Sheet.",
  "chua-cau-hinh": "Chưa nối được Google Sheet: thiếu khóa tài khoản dịch vụ Google (xem hướng dẫn bên dưới).",
  loi: "Đọc Google Sheet bị lỗi, xem chi tiết ở mục Điểm danh offline.",
};

app.post("/du-lieu/diem-danh", async (c) => {
  const r = await syncOfflineAttendance(c.env, new Date());
  return c.redirect(`/du-lieu?dd=${r.status}#diem-danh`, 303);
});

app.notFound((c) =>
  c.html(
    <Layout title="Không tìm thấy">
      <h1>Không tìm thấy trang</h1>
      <p>
        <a href="/">Về trang chủ</a>
      </p>
    </Layout>,
    404,
  ),
);

export default app;
