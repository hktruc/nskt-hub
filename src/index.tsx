import app from "./app";
import type { Env } from "./env";
import { DAILY_CRON, planDaily, workQueue } from "./sync/queue";

export type { Env };

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date(event.scheduledTime);
    if (event.cron === DAILY_CRON) {
      ctx.waitUntil(planDaily(env, now).then((r) => console.log("sync: lên kế hoạch", JSON.stringify(r))));
    } else {
      ctx.waitUntil(
        workQueue(env, now).then((r) => {
          if (r.done > 0 || r.failed > 0) console.log("sync: xử lý hàng đợi", JSON.stringify(r));
        }),
      );
    }
  },
};
