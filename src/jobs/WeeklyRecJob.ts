import { prisma } from "@/lib/db";
import * as RecommendationService from "@/services/RecommendationService";

export class WeeklyRecJob {
  static async run(): Promise<void> {
    const chapters = await prisma.chapters.findMany({
      select: { chapter_id: true, chapter_name: true },
    });

    for (const chapter of chapters) {
      try {
        console.log(`[WeeklyRecJob] ${chapter.chapter_name}: running scheduled cycle`);
        await RecommendationService.runRecommendationCycle(
          chapter.chapter_id,
          "SCHEDULED"
        );
        console.log(`[WeeklyRecJob] ${chapter.chapter_name}: done`);
      } catch (err) {
        console.error(`[WeeklyRecJob] ${chapter.chapter_name} error:`, err);
      }
    }
  }
}
