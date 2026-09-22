"use client";

import { createContext, useContext } from "react";
import type { ChallengeDetail } from "@/lib/challenge";

export interface ChallengeCtx {
  detail: ChallengeDetail;
  /** Re-fetch challenge detail (timing, role, lock state). */
  refresh: () => void;
}

export const ChallengeContext = createContext<ChallengeCtx | null>(null);

export function useChallenge(): ChallengeCtx {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error("useChallenge outside ChallengeContext");
  return ctx;
}
