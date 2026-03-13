import type { FortuneSignalKey } from "./fortune";

export type FortuneFactSource =
  | "today-branch"
  | "branch-structure"
  | "directive"
  | "relation"
  | "recovery"
  | "kuseong"
  | "timing"
  | "category";

export type FortuneFactKind =
  | "branch-interaction"
  | "branch-structure"
  | "directive"
  | "relation"
  | "recovery"
  | "kuseong"
  | "timing"
  | "category-trend";

export type FortuneFactPolarity = "risk" | "opportunity" | "mixed" | "neutral";

export type FortuneFactRawRefs = Record<
  string,
  string | number | boolean | null | string[] | number[]
>;

export type FortuneFact = {
  id: string;
  source: FortuneFactSource;
  kind: FortuneFactKind;
  subtype: string;
  domains: FortuneSignalKey[];
  polarity: FortuneFactPolarity;
  strength: number;
  risk: number;
  opportunity: number;
  summary: string;
  rawRefs: FortuneFactRawRefs;
};

export type SignalContribution = {
  signalKey: FortuneSignalKey;
  factId: string;
  source: FortuneFactSource;
  scoreDelta: number;
  reason: string;
};

export type FortuneEvidence = {
  facts: FortuneFact[];
  signalContributions: SignalContribution[];
};

export function emptyFortuneEvidence(): FortuneEvidence {
  return {
    facts: [],
    signalContributions: [],
  };
}
