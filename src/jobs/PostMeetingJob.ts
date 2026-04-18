import { prisma } from "@/lib/db";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import * as RecommendationService from "@/services/RecommendationService";

export class PostMeetingJob {
  static async run(): Promise<void> {
    const chapters = await prisma.chapters.findMany();

    for (const chapter of chapters) {
      try {
        // a) Get current time in chapter timezone
        const tz = chapter.timezone ?? "Asia/Kolkata";
        const now = toZonedTime(new Date(), tz);
        const currentDay = now.getDay(); // 0=Sun, 1=Mon, ...
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // b) Check if today is meeting day
        if (currentDay !== chapter.meeting_day) continue;

        // c) Calculate trigger time
        const [startH, startM] = chapter.meeting_start_time.split(":").map(Number);
        const meetingStartMinutes = startH * 60 + startM;
        const meetingEndMinutes = meetingStartMinutes + chapter.meeting_duration_mins;
        const triggerMinutes = meetingEndMinutes + chapter.post_meeting_delay_mins;

        // d) Check if current time is within 5-minute window of trigger
        const diff = Math.abs(currentMinutes - triggerMinutes);
        if (diff > 5) continue;

        // e) Check no POST_MEETING run exists for today (in chapter timezone)
        // Build today's start/end in the chapter's timezone, then convert to UTC for DB query
        const todayInTz = new Date(now);
        todayInTz.setHours(0, 0, 0, 0);
        const todayStartUtc = fromZonedTime(todayInTz, tz);

        const todayEndInTz = new Date(now);
        todayEndInTz.setHours(23, 59, 59, 999);
        const todayEndUtc = fromZonedTime(todayEndInTz, tz);

        const existingRun = await prisma.recommendation_runs.findFirst({
          where: {
            chapter_id: chapter.chapter_id,
            trigger_type: "POST_MEETING",
            started_at: { gte: todayStartUtc, lte: todayEndUtc },
          },
        });

        if (existingRun) {
          console.log(`[PostMeetingJob] ${chapter.chapter_name}: already ran today, skipping`);
          continue;
        }

        // f) Run the cycle
        console.log(`[PostMeetingJob] ${chapter.chapter_name}: triggering post-meeting cycle`);
        await RecommendationService.runRecommendationCycle(
          chapter.chapter_id,
          "POST_MEETING"
        );
        console.log(`[PostMeetingJob] ${chapter.chapter_name}: done`);
      } catch (err) {
        console.error(`[PostMeetingJob] ${chapter.chapter_name} error:`, err);
      }
    }
  }
}
