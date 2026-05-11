import type { SemanticTone } from "./types";

/**
 * Optional Tailwind fallbacks when not using inline chipColors (future / tests).
 */
export const SEMANTIC_TONE_BADGE_CLASSES: Record<
  SemanticTone,
  string
> = {
  neutral: "bg-neutral-100 text-neutral-700",
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  accent: "bg-violet-100 text-violet-700",
  primary: "bg-indigo-100 text-indigo-700",
  cyan: "bg-cyan-100 text-cyan-800",
};
