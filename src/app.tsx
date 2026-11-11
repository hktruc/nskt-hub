import { Hono } from "hono";
import { authenticate } from "./auth";
import { addDays, vietnamDay } from "./dates";
import type { Env } from "./env";
import { Layout } from "./layout";
import { DataStatusPage, loadDataStatus } from "./pages/data-status";
import { SubmissionsPage, loadBoard } from "./pages/submissions";
import { LeaderboardPage } from "./pages/leaderboard";
import { loadLeaderboard } from "./scoring/leaderboard";
import { nowVN } from "./scoring/run";
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
