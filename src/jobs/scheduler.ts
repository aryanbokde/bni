import cron from "node-cron";
import { PostMeetingJob } from "./PostMeetingJob";
import { WeeklyRecJob } from "./WeeklyRecJob";
import { ExpireRecsJob } from "./ExpireRecsJob";
import { GeocodingRetryJob } from "./GeocodingRetryJob";
import { WeeklyEmailJob } from "./WeeklyEmailJob";

function wrap(name: string, fn: () => Promise<void>) {
  return async () => {
    const start = Date.now();
    console.log(`[Scheduler] ${name} started`);
    try {
      await fn();
      console.log(`[Scheduler] ${name} completed in ${Date.now() - start}ms`);
    } catch (err) {
      console.error(`[Scheduler] ${name} failed:`, err);
    }
  };
}

export function startScheduler() {
  console.log("[Scheduler] Initializing cron jobs...\n");

  // 1. Post-meeting recommendations — every 5 minutes (checks meeting day/time internally)
  cron.schedule("*/5 * * * *", wrap("PostMeetingJob", PostMeetingJob.run));

  // 2. Weekly recommendation cycle — every Monday at 10 AM
  cron.schedule("0 10 * * 1", wrap("WeeklyRecJob", WeeklyRecJob.run));

  // 3. Expire stale recommendations — daily at 2 AM
  cron.schedule("0 2 * * *", wrap("ExpireRecsJob", ExpireRecsJob.run));

  // 4. Geocoding retry — every 6 hours
  cron.schedule("0 */6 * * *", wrap("GeocodingRetryJob", GeocodingRetryJob.run));

  // 5. Weekly email report — every Monday at 9 AM
  cron.schedule("0 9 * * 1", wrap("WeeklyEmailJob", WeeklyEmailJob.run));

  console.log("[Scheduler] Cron jobs registered:");
  console.log("  1. PostMeetingJob     — */5 * * * *   (every 5 min, checks meeting day/time)");
  console.log("  2. WeeklyRecJob       — 0 10 * * 1    (Monday 10 AM)");
  console.log("  3. ExpireRecsJob      — 0 2 * * *     (daily 2 AM)");
  console.log("  4. GeocodingRetryJob  — 0 */6 * * *   (every 6 hours)");
  console.log("  5. WeeklyEmailJob     — 0 9 * * 1     (Monday 9 AM)\n");
}
