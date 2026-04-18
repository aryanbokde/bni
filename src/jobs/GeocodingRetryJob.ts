import { retryPending } from "@/services/GeocodingService";

export class GeocodingRetryJob {
  static async run(): Promise<void> {
    console.log("[GeocodingRetryJob] Retrying pending geocodes...");
    const result = await retryPending();
    console.log(
      `[GeocodingRetryJob] Done: ${result.retried} retried, ${result.resolved} resolved, ${result.failed} failed`
    );
  }
}
