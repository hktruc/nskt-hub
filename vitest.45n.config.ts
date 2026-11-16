import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Kiểm thử bản khóa 45N-K02 (hồ sơ courses/45n-k2): các trang kỷ luật, trưởng nhóm, tắt bảng xếp hạng.
export default defineConfig({
  resolve: { alias: { "@course": fileURLToPath(new URL("./courses/45n-k2/course.ts", import.meta.url)) } },
  test: { include: ["test/45n/**/*.test.ts"] },
});
