import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { AppError } from "@/lib/AppError";
import { PostMeetingJob } from "@/jobs/PostMeetingJob";
import { WeeklyRecJob } from "@/jobs/WeeklyRecJob";
import { ExpireRecsJob } from "@/jobs/ExpireRecsJob";
import { GeocodingRetryJob } from "@/jobs/GeocodingRetryJob";
import { WeeklyEmailJob } from "@/jobs/WeeklyEmailJob";

// WARNING: This route is for testing/development only.
// Remove or add IP restriction before production deployment.

const JOBS: Record<string, { run: () => Promise<void> }> = {
  "post-meeting": PostMeetingJob,
  "weekly-rec": WeeklyRecJob,
  "expire-recs": ExpireRecsJob,
  "geocoding-retry": GeocodingRetryJob,
  "weekly-email": WeeklyEmailJob,
};

// GET /api/admin/jobs/run/[jobName]
export async function GET(
  req: Request,
  { params }: { params: Record<string, string> }
) {
  // ADMIN only
  const actor = await requireAuth(req);
  requireRole(actor, ["ADMIN"]);

  const jobName = params.jobName;
  const job = JOBS[jobName];

  if (!job) {
    throw new AppError("JOB_NOT_FOUND", 404, {
      message: `Unknown job: ${jobName}. Available: ${Object.keys(JOBS).join(", ")}`,
    });
  }

  const start = Date.now();
  await job.run();
  const duration = Date.now() - start;

  return NextResponse.json({
    data: {
      job: jobName,
      status: "completed",
      durationMs: duration,
    },
  });
}
