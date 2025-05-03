import { getStringWidth } from "@visulima/string";

import type { HorizontalAlignment } from "../types";

/**
 * Pads and aligns content within the available width, applying left and right padding and alignment.
 * @param content The content to align.
 * @param availableWidth The available width for the content (excluding padding).
 * @param alignment The horizontal alignment (left, center, right).
 * @param leftPadding Number of spaces to pad on the left.
 * @param rightPadding Number of spaces to pad on the right.
 * @returns The padded and aligned content string.
 */
const padAndAlignContent = (content: string, availableWidth: number, alignment: HorizontalAlignment, leftPadding: number, rightPadding: number): string => {
    const contentWidth = getStringWidth(content);
    const leftPaddingContent = " ".repeat(Math.max(0, leftPadding));
    const rightPaddingContent = " ".repeat(Math.max(0, rightPadding));

    if (contentWidth === 0) {
        return leftPaddingContent + " ".repeat(Math.max(0, availableWidth)) + rightPaddingContent;
    }

    const remainingSpace = Math.max(0, availableWidth - contentWidth);

    switch (alignment) {
        case "center": {
            const leftSpace = Math.floor(remainingSpace / 2);
            const rightSpace = remainingSpace - leftSpace;

            return leftPaddingContent + " ".repeat(leftSpace) + content + " ".repeat(rightSpace) + rightPaddingContent;
        }
        case "right": {
            return leftPaddingContent + " ".repeat(remainingSpace) + content + rightPaddingContent;
        }
        default: {
            // left
            return leftPaddingContent + content + " ".repeat(remainingSpace) + rightPaddingContent;
        }
    }
};

export default padAndAlignContent;
