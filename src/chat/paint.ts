import { hasRtlScript, toVisualLtr } from "./visualLtr.js";

/**
 * Bubble/prompt body for an LTR cell grid: reshape + visual reorder, no gutter.
 * (The old ▏ gutter looked like a stray `|` on themed bubbles.)
 */
export function paintBubbleText(logical: string): string {
  return toVisualLtr(logical);
}

/**
 * Assistant body: lighten common markdown markers for plain terminal text.
 * RTL still goes through visual reorder; LTR keeps readable emphasis without `**`.
 */
export function paintAssistantText(logical: string): string {
  const cleaned = softenMarkdown(logical);
  return toVisualLtr(cleaned);
}

function softenMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

export type ParagraphDir = "ltr" | "rtl";

const RTL_STRONG =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
/** Latin letters (and Latin Extended) — first strong LTR signal. */
const LTR_STRONG = /[A-Za-z\u00C0-\u024F]/;

/**
 * Unicode-style base direction from the first strong character.
 * "how محمد" → ltr; "اخبار mohamed" → rtl; empty → ltr.
 */
export function paragraphDir(logical: string): ParagraphDir {
  for (const ch of logical) {
    if (RTL_STRONG.test(ch)) return "rtl";
    if (LTR_STRONG.test(ch)) return "ltr";
  }
  return "ltr";
}

/**
 * Input alignment from paragraph base direction.
 * Mixed text follows the first strong letter — not “any Arabic ⇒ right”.
 * Prefer {@link alignLine} for painted prompt rows; flex-end alone often fails
 * because `<text>` stretches full width.
 */
export function lineJustify(logical: string): "flex-start" | "flex-end" {
  return paragraphDir(logical) === "rtl" ? "flex-end" : "flex-start";
}

/**
 * Reply/user bubbles are painted in visual LTR order, so keep them left —
 * right-aligning already-reordered Arabic pushes readable text to the gutter.
 */
export function bubbleJustify(_logical: string): "flex-start" {
  return "flex-start";
}

/**
 * Soft-wrap logical draft lines to a column budget (display only).
 * Hard newlines from Shift+Enter are preserved.
 */
export function wrapDraftLines(logical: string, maxCols: number): string[] {
  const width = Math.max(1, Math.floor(maxCols));
  const hard = logical.length === 0 ? [""] : logical.split("\n");
  const out: string[] = [];

  for (const line of hard) {
    if (line.length === 0) {
      out.push("");
      continue;
    }
    const chars = [...line];
    for (let i = 0; i < chars.length; i += width) {
      out.push(chars.slice(i, i + width).join(""));
    }
  }

  return out.length > 0 ? out : [""];
}

/** Prompt marker: › on the left for LTR, ‹ on the right for RTL. */
export function promptMarker(dir: ParagraphDir): { side: "left" | "right"; glyph: string } {
  return dir === "rtl"
    ? { side: "right", glyph: "‹" }
    : { side: "left", glyph: "›" };
}

export { hasRtlScript };
