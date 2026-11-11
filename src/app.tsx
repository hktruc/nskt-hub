import { Hono } from "hono";
import { authenticate } from "./auth";
import { addDays, vietnamDay } from "./dates";
import type { Env } from "./env";
import { Layout } from "./layout";
import { DataStatusPage, loadDataStatus } from "./pages/data-status";
import { SubmissionsPage, loadBoard } from "./pages/submissions";
import { LeaderboardPage, LearnerDetailPage, LearnerDetailView } from "./pages/leaderboard";
import { FlagsPage, loadFlags } from "./pages/flags";
import { SubmissionDetailPage, loadDetail } from "./pages/submission-detail";
import { loadLeaderboard, loadLearnerDetail } from "./scoring/leaderboard";
import { nowVN, recomputeScores } from "./scoring/run";
import { DAYS_AHEAD, RECENT_DAYS_BACK, enqueueRange, planDaily, planFull, workQueue } from "./sync/queue";

const app = new Hono<{ Bindings: Env; Variables: { email: string } }>();

// Không cần đăng nhập, không chứa dữ liệu.
app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// Bảng xếp hạng công khai (chủ dự án quyết định 11/11/2026): chỉ họ tên, đội, điểm, màu.
app.get("/bang-xep-hang", async (c) => {
  const data = await loadLeaderboard(c.env.DB, nowVN(new Date()));
  const teams = [...new Set(data.ranked.map((r) => r.team))].sort();
  const doi = c.req.query("doi") ?? "";
  c.header("Cache-Control", "public, max-age=300");
  return c.html(
    <LeaderboardPage ranked={data.ranked} team={teams.includes(doi) ? doi : ""} teams={teams} provisional={data.provisional} updatedAt={data.updatedAt} />,
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

// Mọi trang khác: phải đăng nhập qua Cloudflare Access.
app.use("*", async (c, next) => {
  const auth = await authenticate(c.req.raw, c.env);
  if (!auth.ok) {
    return c.html(
      <Layout title="Chưa vào được">
        <h1>Chưa vào được</h1>
        <p>{auth.message}</p>
      </Layout>,
      auth.status,
    );
  }
  // Thao tác ghi chỉ nhận từ chính trang của ứng dụng.
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    if (c.req.header("Origin") !== new URL(c.req.url).origin) {
      return c.text("Yêu cầu không hợp lệ.", 403);
    }
  }
  c.set("email", auth.email);
  await next();
});

app.get("/", (c) =>
  c.html(
    <Layout title="Trang chủ">
      <h1>nskt-hub</h1>
      <p>Web app quản lý học tập NSKT2026 cho BTC. Đang xây dựng.</p>
      <ul>
        <li>
          <a href="/du-lieu">Tình trạng dữ liệu</a>
        </li>
        <li>
          <a href="/nop-bai">Theo dõi nộp bài</a>
        </li>
        <li>Đọc bài và chấm điểm — sắp có (Đợt 3)</li>
        <li>
          <a href="/bang-xep-hang">Bảng xếp hạng (công khai)</a>
        </li>
        <li>Báo cáo thống kê — sắp có (Đợt 5)</li>
      </ul>
    </Layout>,
  ),
);

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
  return c.html(<DataStatusPage status={status} notice={NOTICES[c.req.query("tb") ?? ""]} />);
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
