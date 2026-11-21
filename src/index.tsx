import app from "./app";
import { featureOn } from "./course";
import { faqTick } from "./faq/store";
import type { Env } from "./env";
import { isHourlySlot, syncOfflineAttendance } from "./attendance/offline";
import { syncMemberHistory } from "./members/history";
import { scoringTick } from "./scoring/run";
import { DAILY_CRON, planDaily, planHourly, workQueue } from "./sync/queue";

export type { Env };

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date(event.scheduledTime);
    if (event.cron === DAILY_CRON) {
      ctx.waitUntil(planDaily(env, now).then((r) => console.log("sync: lên kế hoạch", JSON.stringify(r))));
    } else {
      ctx.waitUntil(
        (async () => {
          if (isHourlySlot(now)) {
            const h = await planHourly(env, now);
            if (h) console.log("sync: xếp việc mỗi giờ", h);
            if (featureOn("attendance")) {
              const a = await syncOfflineAttendance(env, now);
              if (a.status !== "chua-cau-hinh") console.log("điểm danh offline:", JSON.stringify(a));
            }
            // Lịch sử thành viên (ngày vào / rời lớp) cho quy tắc người vào sau và người đã rời.
            if (featureOn("leaderboard")) {
              const m = await syncMemberHistory(env, now);
              if (m.status !== "chua-cau-hinh") console.log("lịch sử thành viên:", JSON.stringify(m));
            }
          }
          // FAQ: chạy lần biên tập đang chờ (BTC bấm nút); mỗi giờ xem có câu hỏi mới để tự biên tập lại.
          if (featureOn("faq")) {
            const f = await faqTick(env, now, { auto: isHourlySlot(now) });
            if (f.status === "done" || f.status === "failed") console.log("faq:", JSON.stringify(f));
          }
          const r = await workQueue(env, now);
          if (r.done > 0 || r.failed > 0) console.log("sync: xử lý hàng đợi", JSON.stringify(r));
          const s = await scoringTick(env, now);
          if (s.specs || s.scored || s.ai.reviewed || s.ai.failed) console.log("điểm:", JSON.stringify(s));
        })(),
      );
    }
  },
};
