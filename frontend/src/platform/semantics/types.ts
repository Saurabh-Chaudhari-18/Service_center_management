/**
 * Domain-agnostic semantic presentation types for operational UI.
 * Governance: adapters map domain enums → presentation; components render only.
 */

export type SemanticTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "primary"
  | "cyan";

/** Status chip: label + tone + explicit colors (from legacy domain config via adapters). */
export interface StatusPresentation {
  label: string;
  tone: SemanticTone;
  chipColors: {
    background: string;
    foreground: string;
  };
}

/** Non-status intents (e.g. overrides) — tone without legacy color coupling. */
export interface IntentPresentation {
  label: string;
  tone: SemanticTone;
}
