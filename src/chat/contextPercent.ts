/** Default window when the SDK does not advertise one (Auto / unknown). */
export const DEFAULT_CONTEXT_WINDOW = 200_000;

/**
 * Context fill for the status bar. Clamped 0–100.
 * `totalTokens` comes from SDK usage events; window is configurable.
 */
export function contextPercent(
  totalTokens: number,
  windowTokens: number = DEFAULT_CONTEXT_WINDOW,
): number {
  if (windowTokens <= 0 || totalTokens <= 0) return 0;
  return Math.min(100, Math.round((totalTokens / windowTokens) * 1000) / 10);
}

export function formatContextPercent(pct: number): string {
  if (pct <= 0) return "—";
  const rounded = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${rounded}%`;
}
