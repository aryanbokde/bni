// Node-only instrumentation — isolated so webpack doesn't trace
// nodemailer/fs/crypto into the Edge runtime bundle.
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  try {
    const { startScheduler } = await import("@/jobs/scheduler");
    startScheduler();
  } catch (err) {
    console.error("[Instrumentation] Failed to start scheduler:", err);
  }
}
