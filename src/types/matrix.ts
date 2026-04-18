import type { MemberDecrypted } from "./member";

export type CellState = "SELF" | "GREEN" | "AMBER" | "GAP" | "EXCLUDED";

export interface MatrixCell {
  state: CellState;
  lastInteractionDate?: Date;
  recId?: string;
  recSentAt?: Date;
}

export interface MatrixData {
  members: MemberDecrypted[];
  cells: MatrixCell[][];
}

export interface MemberCoverage {
  totalMembers: number;
  membersMet: number;
  notCovered: number;
  coveragePct: number;
  lastInteractionDate: Date | null;
  pendingRecs: number;
}
