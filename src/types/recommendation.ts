import type { MemberDecrypted } from "./member";

export type RecommendationStatus =
  | "QUEUED"
  | "SENT"
  | "COMPLETED"
  | "EXPIRED"
  | "EXCLUDED";

export interface PairCandidate {
  member_a: MemberDecrypted;
  member_b: MemberDecrypted;
  lastInteractionDate: Date | null;
}
