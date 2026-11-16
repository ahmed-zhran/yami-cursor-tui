import ArabicReshaper from "arabic-persian-reshaper";
import bidiJs from "bidi-js";
import type { Bidi } from "bidi-js";

// bidi-js is a CJS factory; NodeNext types the namespace oddly — assert the call shape.
const bidi = (bidiJs as unknown as () => Bidi)();

/**
 * Prepare mixed-direction text for a terminal that paints cells left-to-right
 * and does not apply Unicode bidi.
 *
 * 1. Reshape Arabic into presentation forms so letters join.
 * 2. Reorder to visual order for an LTR paragraph (UAX #9 via bidi-js).
 *
 * App state and agent prompts keep logical order; only the painted string
 * is transformed.
 */
export function toVisualLtr(logical: string): string {
  if (!logical) return logical;

  const reshaped =
    ArabicReshaper.ArabicShaper.convertArabic(logical) ?? logical;
  const embeddingLevels = bidi.getEmbeddingLevels(reshaped, "ltr");
  return bidi.getReorderedString(reshaped, embeddingLevels);
}

/**
 * Inverse of {@link toVisualLtr} for input buffers that show visual order.
 * Pure LTR strings pass through unchanged.
 */
export function fromVisualLtr(visual: string): string {
  if (!visual) return visual;
  if (!hasRtlScript(visual)) return visual;

  const embeddingLevels = bidi.getEmbeddingLevels(visual, "ltr");
  const reshapedLogical = bidi.getReorderedString(visual, embeddingLevels);
  return (
    ArabicReshaper.ArabicShaper.convertArabicBack(reshapedLogical) ??
    reshapedLogical
  );
}

/** True when the string contains a strong RTL letter (Arabic, Hebrew, etc.). */
export function hasRtlScript(text: string): boolean {
  return /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    text,
  );
}
