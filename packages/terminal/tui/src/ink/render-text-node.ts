/**
 * StyledChar-based text node rendering.
 *
 * Handles text measurement, wrapping, padding, cursor positioning,
 * and selection highlighting for ink-text nodes using the StyledChar pipeline.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import type { StyledChar } from "@alcalzone/ansi-tokenize";

import type { DOMElement, DOMNode } from "./dom";
import getMaxWidth from "./get-max-width";
import { measureStyledChars, splitStyledCharsByNewline, toStyledCharacters } from "./measure-text";
import type Output from "./output";
import type { OutputTransformer } from "./render-node-to-output";
import { applySelectionToStyledChars } from "./selection";
import squashTextNodes from "./squash-text-nodes";
import { wrapOrTruncateStyledChars } from "./text-wrap";

/**
 * Apply padding to StyledChar lines based on the first child node's computed position.
 */
export const applyPaddingToStyledChars = (node: DOMElement, lines: StyledChar[][]): StyledChar[][] => {
    const yogaNode = node.childNodes[0]?.yogaNode;

    if (yogaNode) {
        const offsetX = yogaNode.getComputedLeft();
        const offsetY = yogaNode.getComputedTop();

        const space: StyledChar = {
            fullWidth: false,
            styles: [],
            type: "char",
            value: " ",
        };

        const paddingLeft = Array.from<StyledChar>({ length: offsetX }).fill(space);

        lines = lines.map((line) => [...paddingLeft, ...line]);

        const paddingTop: StyledChar[][] = Array.from<StyledChar[]>({ length: offsetY }).fill([]);

        lines.unshift(...paddingTop);
    }

    return lines;
};

/**
 * Calculate cursor position within wrapped text lines.
 * Maps a target character offset in the original text to a line index
 * and relative position within that wrapped line.
 */
export const calculateWrappedCursorPosition = (
    lines: StyledChar[][],
    styledChars: StyledChar[],
    targetOffset: number,
): { cursorLineIndex: number; relativeCursorPosition: number } => {
    const styledCharToOffset = new Map<StyledChar, number>();
    let offset = 0;

    for (const char of styledChars) {
        styledCharToOffset.set(char, offset);
        offset += char.value.length;
    }

    let cursorLineIndex = lines.length - 1;
    let relativeCursorPosition = targetOffset;
    // -1 represents "before document start" so first character (offset 0) is handled correctly
    let previousLineEndOffset = -1;

    for (const [index, line] of lines.entries()) {
        if (line.length > 0) {
            const firstChar = line.find((char) => styledCharToOffset.has(char));
            const lastChar = line.findLast((char) => styledCharToOffset.has(char));

            if (!firstChar || !lastChar) {
                // Padding-only line, treat as empty
                if (targetOffset > previousLineEndOffset) {
                    cursorLineIndex = index;
                    relativeCursorPosition = targetOffset - previousLineEndOffset - 1;
                    previousLineEndOffset++;
                }

                continue;
            }

            const lineStartOffset = styledCharToOffset.get(firstChar)!;
            const lineEndOffset = styledCharToOffset.get(lastChar)! + lastChar.value.length;

            if (targetOffset >= lineStartOffset) {
                cursorLineIndex = index;
                relativeCursorPosition = Math.max(0, targetOffset - lineStartOffset);
            }

            if (targetOffset <= lineEndOffset) {
                break;
            }

            previousLineEndOffset = lineEndOffset;
        } else if (index === 0 && targetOffset === 0) {
            cursorLineIndex = 0;
            relativeCursorPosition = 0;
            break;
        } else if (index > 0 && targetOffset > previousLineEndOffset) {
            cursorLineIndex = index;
            relativeCursorPosition = targetOffset - previousLineEndOffset - 1;
            previousLineEndOffset++;
        }
    }

    return { cursorLineIndex, relativeCursorPosition };
};

/**
 * Render an ink-text node to output using the StyledChar pipeline.
 *
 * This handles text squashing, styled character tokenization, wrapping/truncation,
 * padding, selection highlighting, and cursor positioning.
 */
export const handleTextNode = (
    node: DOMElement,
    output: Output,
    options: {
        selectionMap?: Map<DOMNode, { end: number; start: number }>;
        selectionStyle?: (char: StyledChar) => StyledChar;
        transformers: OutputTransformer[];
        x: number;
        y: number;
    },
): void => {
    const { selectionMap, selectionStyle, transformers, x, y } = options;
    const text = squashTextNodes(node);
    let styledChars = toStyledCharacters(text);

    // Apply selection highlighting if this node is in the selection map
    const selectionRange = selectionMap?.get(node);

    if (selectionRange) {
        styledChars = applySelectionToStyledChars(styledChars, { currentOffset: 0, range: selectionRange }, selectionStyle);
    }

    if (styledChars.length === 0) {
        return;
    }

    const { width: currentWidth } = measureStyledChars(styledChars);
    const maxWidth = getMaxWidth(node.yogaNode!);

    let lines: StyledChar[][] =
        currentWidth > maxWidth ? wrapOrTruncateStyledChars(styledChars, maxWidth, node.style.textWrap ?? "wrap") : splitStyledCharsByNewline(styledChars);

    lines = applyPaddingToStyledChars(node, lines);

    // Write each line to the output using the StyledChar path
    for (const [index, line] of lines.entries()) {
        output.writeStyledChars(x, y + index, line, { transformers });
    }
};
