import { Hono } from "hono";
import { Layout } from "./layout";

export type Env = {
  APP_NAME: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_NAME }));

app.get("/", (c) =>
  c.html(
    <Layout title="Trang chủ">
      <h1>nskt-hub</h1>
      <p>Web app quản lý học tập NSKT2026 cho BTC. Đang xây dựng.</p>
      <ul>
        <li>Tình trạng dữ liệu — sắp có (Đợt 1)</li>
        <li>Bảng theo dõi nộp bài — sắp có (Đợt 2)</li>
        <li>Đọc bài và chấm điểm — sắp có (Đợt 3)</li>
        <li>Bảng xếp hạng — sắp có (Đợt 4)</li>
        <li>Báo cáo thống kê — sắp có (Đợt 5)</li>
      </ul>
    </Layout>,
  ),
);

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
