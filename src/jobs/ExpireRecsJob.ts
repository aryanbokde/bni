import { prisma } from "@/lib/db";
import * as RecommendationService from "@/services/RecommendationService";

export class ExpireRecsJob {
  static async run(): Promise<void> {
    const chapters = await prisma.chapters.findMany({
      select: { chapter_id: true, chapter_name: true },
    });

    let total = 0;
    for (const chapter of chapters) {
      try {
        const count = await RecommendationService.expireStaleRecommendations(
          chapter.chapter_id
        );
        if (count > 0) {
          console.log(`[ExpireRecsJob] ${chapter.chapter_name}: expired ${count} recs`);
        }
        total += count;
      } catch (err) {
        console.error(`[ExpireRecsJob] ${chapter.chapter_name} error:`, err);
      }
    }

    console.log(`[ExpireRecsJob] Total expired: ${total} across ${chapters.length} chapters`);
  }
}
