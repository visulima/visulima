/**
 * StyledLine-based text node rendering.
 *
 * Handles text measurement, wrapping, padding, cursor positioning,
 * and selection highlighting for ink-text nodes using the StyledLine pipeline.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */

import type { DOMElement, DOMNode } from "./dom";
import getMaxWidth from "./get-max-width";
import { measureStyledLine, splitStyledLineByNewline, toStyledLine } from "./measure-text";
import type Output from "./output";
import type { OutputTransformer } from "./render-node-to-output";
import { applySelectionToStyledLine } from "./selection";
import squashTextNodes from "./squash-text-nodes";
import type { StyledLine } from "./styled-line";
import { wrapOrTruncateStyledLine } from "./text-wrap";

/**
 * Apply padding to StyledLine array based on the first child node's computed position.
 */
const applyPaddingToStyledLines = (node: DOMElement, lines: StyledLine[]): StyledLine[] => {
    const yogaNode = node.childNodes[0]?.yogaNode;

    if (yogaNode) {
        const offsetX = Math.round(yogaNode.getComputedLeft());
        const offsetY = Math.round(yogaNode.getComputedTop());

        if (offsetX > 0) {
            const { StyledLine: SL } = require("./styled-line") as typeof import("./styled-line");
            const padding = SL.empty(offsetX);

            lines = lines.map((line) => padding.combine(line));
        }

        if (offsetY > 0) {
            const { StyledLine: SL } = require("./styled-line") as typeof import("./styled-line");
            const paddingTop: StyledLine[] = Array.from({ length: offsetY }, () => new SL());

            lines.unshift(...paddingTop);
        }
    }

    return lines;
};

/**
 * Render an ink-text node to output.
 *
 * Uses the StyledLine pipeline for both selection and non-selection paths.
 * When selection is active, applies INVERSE styling directly on the StyledLine.
 */
export const handleTextNode = (
    node: DOMElement,
    output: Output,
    options: {
        selectionMap?: Map<DOMNode, { end: number; start: number }>;
        transformers: OutputTransformer[];
        x: number;
        y: number;
    },
): void => {
    const { selectionMap, x, y } = options;
    const text = squashTextNodes(node);

    let styledLine = toStyledLine(text);

    if (styledLine.length === 0) {
        return;
    }

    // Apply selection highlighting if active for this node
    const selectionRange = selectionMap?.get(node);

    if (selectionRange) {
        styledLine = applySelectionToStyledLine(styledLine, selectionRange);
    }

    const { width: currentWidth } = measureStyledLine(styledLine);
    const maxWidth = getMaxWidth(node.yogaNode!);

    let lines: StyledLine[] =
        currentWidth > maxWidth
            ? wrapOrTruncateStyledLine(styledLine, Math.floor(maxWidth), node.style.textWrap ?? "wrap")
            : splitStyledLineByNewline(styledLine);

    lines = applyPaddingToStyledLines(node, lines);

    // Write each line directly as StyledLine (skips bridge conversion)
    for (const [index, line] of lines.entries()) {
        output.writeStyledLine(x, y + index, line);
    }
};
