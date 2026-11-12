import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { authenticate } from "./auth";
import { addDays, vietnamDay } from "./dates";
import type { Env } from "./env";
import { Layout } from "./layout";
import { DataStatusPage, loadDataStatus } from "./pages/data-status";
import { SubmissionsPage, loadBoard } from "./pages/submissions";
import { loadOverview, OverviewPage } from "./pages/overview";
import { syncOfflineAttendance } from "./attendance/offline";
import { AccountPage, ActivatePage, ForbiddenPage, LoginPage, NeedLoginPage } from "./pages/account";
import { QueuePage, SheetPage } from "./pages/grading";
import { GradersPage } from "./pages/graders";
import { loadGraderStats } from "./grading/stats";
import { FOCUS_OPTIONS, PROGRESS, SPIRIT } from "./grading/rubric";
import { allowedTeams, focusOf, gradableAssignments, loadQueue, loadSheet, saveReview, setFocus, validate, type SaveInput } from "./grading/store";
import { AdminPage, type IssuedCode } from "./pages/admin";
import {
  AccountError, SESSION_COOKIE, SESSION_MAX_AGE, activate, canUseFullApp, changePassword, createUser, listUsers, login, logout,
  reissueCode, sessionUser, setActive, setRole, setTeams, userLabel, type User,
} from "./users/accounts";
import { LeaderboardPage, LearnerDetailPage, LearnerDetailView } from "./pages/leaderboard";
import { FlagsPage, loadFlags } from "./pages/flags";
import { SubmissionDetailPage, loadDetail } from "./pages/submission-detail";
import { loadLeaderboard, loadLearnerDetail } from "./scoring/leaderboard";
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
app.get("/bang-xep-hang", async (c) => {
  const data = await loadLeaderboard(c.env.DB, nowVN(new Date()));
  const teams = [...new Set(data.ranked.map((r) => r.team))].sort();
  const doi = c.req.query("doi") ?? "";
  c.header("Cache-Control", "public, max-age=300");
  return c.html(
    <LeaderboardPage ranked={data.ranked} team={teams.includes(doi) ? doi : ""} teams={teams} provisional={data.provisional} hasAttendance={data.hasAttendance} updatedAt={data.updatedAt} />,
  );
});

// Chi tiết một học viên trên bảng xếp hạng (công khai như bảng xếp hạng). `?p=1`: chỉ phần nội dung cho cửa sổ bật lên.
app.get("/bang-xep-hang/hv/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const d = Number.isSafeInteger(id) ? await loadLearnerDetail(c.env.DB, id, nowVN(new Date())) : null;
  if (!d) return c.text("Không tìm thấy học viên trên bảng xếp hạng.", 404);
  c.header("Cache-Control", "public, max-age=300");
  return c.html(c.req.query("p") ? <LearnerDetailView d={d} inDialog /> : <LearnerDetailPage d={d} />);
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
  if (!canUseFullApp(user) && path === "/") return c.redirect("/cham", 303);
  if (!canUseFullApp(user) && !GRADER_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return c.html(<ForbiddenPage user={user} message="Tài khoản ban phụng sự chỉ dùng bàn chấm bài." />, 403);
  }
  if ((path === "/quan-tri" || path.startsWith("/quan-tri/")) && user.role !== "admin") {
    return c.html(<ForbiddenPage user={user} message="Chỉ admin mới vào được trang quản trị." />, 403);
  }
  c.set("user", user);
  c.set("email", userLabel(user));
  await next();
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
  const allowed = allowedTeams(u);
  const lines = week ? await loadQueue(c.env.DB, week, allowed, nowVNs) : [];
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
  const s = await loadSheet(c.env.DB, hv, bt);
  if (!s) return null;
  const allowed = allowedTeams(c.get("user"));
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
  // Sang người tiếp theo chưa chấm: ưu tiên cùng đội.
  const week = { id: s.assignment.id, title: s.assignment.title, type: s.assignment.type, due_at: s.assignment.due_at };
  const lines = await loadQueue(c.env.DB, week, allowedTeams(c.get("user")), nowVN(new Date()));
  const todo = lines.filter((l) => l.learnerId !== s.learner.id && (l.status === "chua-cham" || l.status === "dang-cham" || l.status === "sua-sau-cham"));
  const next = todo.find((l) => l.team === s.learner.team) ?? todo[0];
  return c.redirect(next ? `/cham/bai?hv=${next.learnerId}&bt=${s.assignment.id}` : `/cham?bt=${s.assignment.id}&tb=het-viec`, 303);
});

app.get("/cham/nguoi-cham", async (c) => {
  const u = c.get("user");
  if (u.role === "phung_su") return c.html(<ForbiddenPage user={u} message="Trang này dành cho coach, BTC, admin." />, 403);
  const { graders, overall } = await loadGraderStats(c.env.DB);
  const rows = (await c.env.DB.prepare("SELECT user_id, team_code FROM grader_teams ORDER BY team_code").all<{ user_id: number; team_code: string }>()).results;
  const teamsOf = new Map<number, string[]>();
  for (const r of rows) teamsOf.set(r.user_id, [...(teamsOf.get(r.user_id) ?? []), r.team_code]);
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
  await setTeams(c.env.DB, u.id, f.getAll("doi").map(String), c.get("email"), new Date());
  return c.redirect("/quan-tri?tb=doi", 303);
});

app.get("/", async (c) => c.html(<OverviewPage o={await loadOverview(c.env)} />));

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
