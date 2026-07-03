import { getBackgroundColorEscape } from "./colorize";
import type { DOMNode } from "./dom";
import type Output from "./output";

const renderBackground = (x: number, y: number, node: DOMNode, output: Output): void => {
    if (!node.style.backgroundColor) {
        return;
    }

    const width = Math.round(node.yogaNode!.getComputedWidth());
    const height = Math.round(node.yogaNode!.getComputedHeight());

    // Calculate the actual content area considering borders
    const leftBorderWidth = node.style.borderStyle && node.style.borderLeft !== false ? 1 : 0;
    const rightBorderWidth = node.style.borderStyle && node.style.borderRight !== false ? 1 : 0;
    const topBorderHeight = node.style.borderStyle && node.style.borderTop !== false ? 1 : 0;
    const bottomBorderHeight = node.style.borderStyle && node.style.borderBottom !== false ? 1 : 0;

    const contentWidth = width - leftBorderWidth - rightBorderWidth;
    const contentHeight = height - topBorderHeight - bottomBorderHeight;

    if (!(contentWidth > 0 && contentHeight > 0)) {
        return;
    }

    // Build the background string once using raw escape codes
    const bgEsc = getBackgroundColorEscape(node.style.backgroundColor);

    if (!bgEsc) {
        return;
    }

    const backgroundLine = `${bgEsc}${" ".repeat(contentWidth)}\u001B[49m`;

    for (let row = 0; row < contentHeight; row++) {
        output.write(x + leftBorderWidth, y + topBorderHeight + row, backgroundLine, { transformers: [] });
    }
};

export default renderBackground;
