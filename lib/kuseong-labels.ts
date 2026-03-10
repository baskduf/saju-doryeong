export type FortuneCategoryLabelKey = "work" | "money" | "relationship" | "health";
export type KuseongToneLabelKey = "push" | "steady" | "cautious" | "recover";

const CATEGORY_LABELS: Record<FortuneCategoryLabelKey, string> = {
  work: "일과",
  money: "재물",
  relationship: "관계",
  health: "회복",
};

const CATEGORY_NARRATIVE_LABELS: Record<FortuneCategoryLabelKey, string> = {
  work: "일",
  money: "재물",
  relationship: "관계",
  health: "회복",
};

const NARRATIVE_TONE_LABELS: Record<KuseongToneLabelKey, string> = {
  push: "속도형",
  steady: "안정형",
  cautious: "신중형",
  recover: "회복형",
};

export function kuseongCategoryDisplayLabel(key: FortuneCategoryLabelKey): string {
  return CATEGORY_LABELS[key];
}

export function kuseongCategoryNarrativeLabel(key: FortuneCategoryLabelKey): string {
  return CATEGORY_NARRATIVE_LABELS[key];
}

export function kuseongToneLabel(value: KuseongToneLabelKey): string {
  return NARRATIVE_TONE_LABELS[value];
}

export function kuseongFocusLabel(keys: FortuneCategoryLabelKey[]): string {
  return keys.map(kuseongCategoryDisplayLabel).join("·");
}
