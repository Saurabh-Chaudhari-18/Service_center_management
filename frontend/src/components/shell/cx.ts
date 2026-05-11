/**
 * Lightweight class merger for shell composites (no tailwind-merge dependency).
 */
export function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}
