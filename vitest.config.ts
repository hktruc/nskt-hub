import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Kiểm thử chạy với hồ sơ khóa NSKT2026 (giống bản đang chạy thật).
export default defineConfig({
  resolve: { alias: { "@course": fileURLToPath(new URL("./courses/nskt2026/course.ts", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"], exclude: ["test/45n/**", "node_modules/**"] },
});
