// Node-only instrumentation — isolated so webpack doesn't trace
// nodemailer/fs/crypto into the Edge runtime bundle.
declare global {
  // Prevent duplicate cron registrations during Next.js reloads.
  // eslint-disable-next-line no-var
  var __bniSchedulerStarted__: boolean | undefined;
}

function isSchedulerEnabled(): boolean {
  const flag = process.env.SCHEDULER_ENABLED;
  if (!flag) return true;
  return !["0", "false", "no", "off"].includes(flag.toLowerCase());
}

export async function register() {
  if (!isSchedulerEnabled()) {
    console.log("[Instrumentation] Scheduler disabled by SCHEDULER_ENABLED");
    return;
  }

  if (globalThis.__bniSchedulerStarted__) {
    console.log("[Instrumentation] Scheduler already started, skipping duplicate registration");
    return;
  }

  try {
    const { startScheduler } = await import("@/jobs/scheduler");
    startScheduler();
    globalThis.__bniSchedulerStarted__ = true;
    console.log(
      `[Instrumentation] Scheduler started in ${process.env.NODE_ENV ?? "unknown"} mode`
    );
  } catch (err) {
    console.error("[Instrumentation] Failed to start scheduler:", err);
  }
}
