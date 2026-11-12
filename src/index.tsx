import app from "./app";
import type { Env } from "./env";
import { isHourlySlot, syncOfflineAttendance } from "./attendance/offline";
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
            const a = await syncOfflineAttendance(env, now);
            if (a.status !== "chua-cau-hinh") console.log("điểm danh offline:", JSON.stringify(a));
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
