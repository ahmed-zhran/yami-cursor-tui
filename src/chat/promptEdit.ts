import ArabicReshaper from "arabic-persian-reshaper";
import bidiJs from "bidi-js";
import type { Bidi } from "bidi-js";
import type { ParagraphDir } from "./paint.js";
import { toVisualLtr } from "./visualLtr.js";

const bidi = (bidiJs as unknown as () => Bidi)();

export type WrapSeg = {
  text: string;
  /** Inclusive UTF-16 start in the full logical draft. */
  start: number;
  /** Exclusive UTF-16 end in the full logical draft. */
  end: number;
};

export function clampCaret(text: string, caret: number): number {
  return Math.max(0, Math.min(Math.floor(caret), text.length));
}

export function insertAt(
  text: string,
  caret: number,
  chunk: string,
): { text: string; caret: number } {
  const c = clampCaret(text, caret);
  return {
    text: text.slice(0, c) + chunk + text.slice(c),
    caret: c + chunk.length,
  };
}

export function deleteBackward(
  text: string,
  caret: number,
): { text: string; caret: number } {
  const c = clampCaret(text, caret);
  if (c <= 0) return { text, caret: 0 };
  const before = [...text.slice(0, c)];
  before.pop();
  const nextBefore = before.join("");
  return { text: nextBefore + text.slice(c), caret: nextBefore.length };
}

export function deleteForward(
  text: string,
  caret: number,
): { text: string; caret: number } {
  const c = clampCaret(text, caret);
  if (c >= text.length) return { text, caret: c };
  const after = [...text.slice(c)];
  after.shift();
  return { text: text.slice(0, c) + after.join(""), caret: c };
}

/** Soft-wrap logical draft into segments with absolute index ranges. */
export function wrapDraftSegments(
  logical: string,
  maxCols: number,
): WrapSeg[] {
  const width = Math.max(1, Math.floor(maxCols));
  if (logical.length === 0) {
    return [{ text: "", start: 0, end: 0 }];
  }

  const out: WrapSeg[] = [];
  let offset = 0;
  const hardParts = logical.split("\n");

  for (let h = 0; h < hardParts.length; h++) {
    const part = hardParts[h] ?? "";
    if (part.length === 0) {
      out.push({ text: "", start: offset, end: offset });
    } else {
      const cps = [...part];
      let cpOffset = 0;
      while (cpOffset < cps.length) {
        const slice = cps.slice(cpOffset, cpOffset + width);
        const text = slice.join("");
        const start = offset + cps.slice(0, cpOffset).join("").length;
        out.push({ text, start, end: start + text.length });
        cpOffset += width;
      }
    }
    offset += part.length;
    if (h < hardParts.length - 1) {
      // Skip the newline separator in the absolute index.
      offset += 1;
    }
  }

  return out.length > 0 ? out : [{ text: "", start: 0, end: 0 }];
}

function reshape(logical: string): string {
  return ArabicReshaper.ArabicShaper.convertArabic(logical) ?? logical;
}

/** Visual column for a caret sitting before logical UTF-16 index `caret`. */
export function logicalCaretToVisual(logical: string, caret: number): number {
  const c = clampCaret(logical, caret);
  if (!logical) return 0;
  if (c >= logical.length) return [...toVisualLtr(logical)].length;

  const reshaped = reshape(logical);
  const levels = bidi.getEmbeddingLevels(reshaped, "ltr");
  const visualToLogical = bidi.getReorderedIndices(reshaped, levels);
  const v = visualToLogical.indexOf(c);
  return v < 0 ? visualToLogical.length : v;
}

/** Logical caret from a visual column within one logical line. */
export function visualCaretToLogical(
  logical: string,
  visualCaret: number,
): number {
  if (!logical) return 0;
  const reshaped = reshape(logical);
  const levels = bidi.getEmbeddingLevels(reshaped, "ltr");
  const visualToLogical = bidi.getReorderedIndices(reshaped, levels);
  if (visualCaret <= 0) return 0;
  if (visualCaret >= visualToLogical.length) return logical.length;
  return visualToLogical[visualCaret] ?? logical.length;
}

/** Move caret left/right by visual columns (arrow keys). */
export function moveCaretVisual(
  logical: string,
  caret: number,
  delta: number,
): number {
  const v = logicalCaretToVisual(logical, caret);
  return visualCaretToLogical(logical, v + delta);
}

export function paintLineWithCaret(
  logicalLine: string,
  localCaret: number | null,
  cursorOn: boolean,
): string {
  const visual = toVisualLtr(logicalLine);
  if (localCaret === null) return visual;
  const v = logicalCaretToVisual(logicalLine, localCaret);
  const cur = cursorOn ? "▌" : " ";
  const chars = [...visual];
  return chars.slice(0, v).join("") + cur + chars.slice(v).join("");
}

/** Pad so RTL drafts sit on the right even when flex-end does not shrink text. */
export function alignLine(
  content: string,
  cols: number,
  dir: ParagraphDir,
): string {
  const width = Math.max(1, cols);
  const len = [...content].length;
  if (dir !== "rtl" || len >= width) return content;
  return `${" ".repeat(width - len)}${content}`;
}

export function findSegIndex(segs: WrapSeg[], caret: number): number {
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!seg) continue;
    if (caret >= seg.start && caret <= seg.end) {
      // Prefer the segment that owns caret when on a boundary (except first).
      if (caret === seg.end && i + 1 < segs.length && caret === segs[i + 1]?.start) {
        continue;
      }
      return i;
    }
  }
  return Math.max(0, segs.length - 1);
}

/**
 * Move caret one wrapped line up/down.
 * No line above → start of current line; no line below → end of draft.
 */
export function moveCaretVertical(
  logical: string,
  caret: number,
  cols: number,
  direction: "up" | "down",
): number {
  const segs = wrapDraftSegments(logical, cols);
  const idx = findSegIndex(segs, caret);
  const cur = segs[idx];
  if (!cur) return clampCaret(logical, caret);

  if (direction === "up") {
    if (idx <= 0) return cur.start;
    const prev = segs[idx - 1];
    if (!prev) return cur.start;
    const local = caret - cur.start;
    return prev.start + Math.min(local, prev.text.length);
  }

  if (idx >= segs.length - 1) return logical.length;
  const next = segs[idx + 1];
  if (!next) return logical.length;
  const local = caret - cur.start;
  return next.start + Math.min(local, next.text.length);
}

/**
 * Empty-prompt display: caret sits right after the marker so it stays visible
 * even when the hint text is long.
 */
export function emptyPromptLine(
  markerGlyph: string,
  placeholder: string,
  cols: number,
  dir: ParagraphDir,
  cursorOn: boolean,
  cursorChar = "▌",
): string {
  const cur = cursorOn ? cursorChar : " ";
  if (dir === "rtl") {
    return alignLine(`${cur} ${markerGlyph}`, cols, "rtl");
  }
  const lead = `${markerGlyph} ${cur}`;
  const budget = Math.max(0, cols - [...lead].length);
  const hint = [...placeholder].slice(0, budget).join("");
  return `${lead}${hint}`;
}
