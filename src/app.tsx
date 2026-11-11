import { Hono } from "hono";
import { authenticate } from "./auth";
import { addDays, vietnamDay } from "./dates";
import type { Env } from "./env";
import { Layout } from "./layout";
import { DataStatusPage, loadDataStatus } from "./pages/data-status";
import { DAYS_AHEAD, RECENT_DAYS_BACK, enqueueRange, planDaily, planFull, workQueue } from "./sync/queue";

const app = new Hono<{ Bindings: Env; Variables: { email: string } }>();

// Không cần đăng nhập, không chứa dữ liệu.
app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

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
        <li>Bảng theo dõi nộp bài — sắp có (Đợt 2)</li>
        <li>Đọc bài và chấm điểm — sắp có (Đợt 3)</li>
        <li>Bảng xếp hạng — sắp có (Đợt 4)</li>
        <li>Báo cáo thống kê — sắp có (Đợt 5)</li>
      </ul>
    </Layout>,
  ),
);

const NOTICES: Record<string, string> = {
  "da-xep": "Đã xếp việc vào hàng đợi. Dữ liệu sẽ về dần; tải lại trang này sau vài phút.",
  "khong-co-gi-moi": "Các khoảng ngày này đã nằm sẵn trong hàng đợi, không cần xếp thêm.",
};

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
