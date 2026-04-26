/* eslint-disable import/no-extraneous-dependencies, import/no-named-as-default-member */
import colorizeDefault from "@visulima/colorize";
import cliBoxes from "cli-boxes";

import colorize from "./colorize";
import type { DOMNode } from "./dom";
import type Output from "./output";

const stylePiece = (segment: string, fg?: string, bg?: string, dim?: boolean): string => {
    let styled = colorize(segment, fg, "foreground");

    styled = colorize(styled, bg, "background");

    if (dim) {
        styled = colorizeDefault.dim(styled);
    }

    return styled;
};

/**
 * Embed title text into a border line.
 * @param borderChar The horizontal border character (e.g., "─")
 * @param contentWidth Available width between corners
 * @param title Text to embed (left/center aligned)
 * @param titleAlignment "left" | "center" | "right"
 * @param rightTitle Optional text on the right side
 * @param borderFg Border foreground color
 * @param borderBg Border background color
 * @param borderDim Whether to dim the border
 * @returns The styled border string (without corner characters)
 */
const buildBorderWithTitle = (
    borderChar: string,
    contentWidth: number,
    title?: string,
    titleAlignment?: "center" | "left" | "right",
    rightTitle?: string,
    borderFg?: string,
    borderBg?: string,
    borderDim?: boolean,
): string => {
    if (!title && !rightTitle) {
        return stylePiece(borderChar.repeat(contentWidth), borderFg, borderBg, borderDim);
    }

    const leftTitle = title ? ` ${title} ` : "";
    const right = rightTitle ? ` ${rightTitle} ` : "";
    const leftLength = leftTitle.length;
    const rightLength = right.length;
    const alignment = titleAlignment ?? "left";

    // If both titles together exceed width, truncate the right title first, then left
    if (leftLength + rightLength >= contentWidth) {
        if (leftLength >= contentWidth) {
            // Left title alone exceeds width -- truncate it
            return `${leftTitle.slice(0, contentWidth - 1)}\u2026`;
        }

        // Left title fits, truncate or drop the right title
        const remainingForRight = contentWidth - leftLength;

        if (remainingForRight > 3) {
            return leftTitle + right.slice(0, remainingForRight);
        }

        // Not enough space for right title, fill with border
        return leftTitle + stylePiece(borderChar.repeat(contentWidth - leftLength), borderFg, borderBg, borderDim);
    }

    const middleWidth = contentWidth - leftLength - rightLength;

    if (alignment === "left" || rightTitle) {
        // Left-aligned title + fill + right title
        return leftTitle + stylePiece(borderChar.repeat(middleWidth), borderFg, borderBg, borderDim) + right;
    }

    if (alignment === "right") {
        const fillWidth = contentWidth - leftLength;

        return stylePiece(borderChar.repeat(fillWidth), borderFg, borderBg, borderDim) + leftTitle;
    }

    // Center
    const leftFill = Math.floor(middleWidth / 2);
    const rightFill = middleWidth - leftFill;

    return (
        stylePiece(borderChar.repeat(leftFill), borderFg, borderBg, borderDim)
        + leftTitle
        + stylePiece(borderChar.repeat(rightFill), borderFg, borderBg, borderDim)
    );
};

const renderBorder = (x: number, y: number, node: DOMNode, output: Output): void => {
    if (node.style.borderStyle) {
        const width = Math.round(node.yogaNode!.getComputedWidth());
        const height = Math.round(node.yogaNode!.getComputedHeight());
        const box = typeof node.style.borderStyle === "string" ? cliBoxes[node.style.borderStyle] : node.style.borderStyle;

        const topBorderColor = node.style.borderTopColor ?? node.style.borderColor;
        const bottomBorderColor = node.style.borderBottomColor ?? node.style.borderColor;
        const leftBorderColor = node.style.borderLeftColor ?? node.style.borderColor;
        const rightBorderColor = node.style.borderRightColor ?? node.style.borderColor;

        const topBorderBackgroundColor = node.style.borderTopBackgroundColor ?? node.style.borderBackgroundColor;
        const bottomBorderBackgroundColor = node.style.borderBottomBackgroundColor ?? node.style.borderBackgroundColor;
        const leftBorderBackgroundColor = node.style.borderLeftBackgroundColor ?? node.style.borderBackgroundColor;
        const rightBorderBackgroundColor = node.style.borderRightBackgroundColor ?? node.style.borderBackgroundColor;

        const dimTopBorderColor = node.style.borderTopDimColor ?? node.style.borderDimColor;
        const dimBottomBorderColor = node.style.borderBottomDimColor ?? node.style.borderDimColor;
        const dimLeftBorderColor = node.style.borderLeftDimColor ?? node.style.borderDimColor;
        const dimRightBorderColor = node.style.borderRightDimColor ?? node.style.borderDimColor;

        const showTopBorder = node.style.borderTop !== false;
        const showBottomBorder = node.style.borderBottom !== false;
        const showLeftBorder = node.style.borderLeft !== false;
        const showRightBorder = node.style.borderRight !== false;

        const contentWidth = Math.max(0, width - (showLeftBorder ? 1 : 0) - (showRightBorder ? 1 : 0));

        // ── Top border (with optional titles) ──────────────────────
        let topBorder: string | undefined;

        if (showTopBorder) {
            const topLeftCorner = showLeftBorder ? stylePiece(box.topLeft, topBorderColor, topBorderBackgroundColor, dimTopBorderColor) : "";
            const topRightCorner = showRightBorder ? stylePiece(box.topRight, topBorderColor, topBorderBackgroundColor, dimTopBorderColor) : "";

            const topContent = buildBorderWithTitle(
                box.top,
                contentWidth,
                node.style.borderTopTitle,
                node.style.borderTopTitleAlignment,
                node.style.borderTopRightTitle,
                topBorderColor,
                topBorderBackgroundColor,
                dimTopBorderColor,
            );

            topBorder = topLeftCorner + topContent + topRightCorner;
        }

        let verticalBorderHeight = height;

        if (showTopBorder) {
            verticalBorderHeight -= 1;
        }

        if (showBottomBorder) {
            verticalBorderHeight -= 1;
        }

        verticalBorderHeight = Math.max(0, verticalBorderHeight);

        let leftBorder = "";

        if (showLeftBorder) {
            const one = stylePiece(box.left, leftBorderColor, leftBorderBackgroundColor, dimLeftBorderColor);

            leftBorder = `${one}\n`.repeat(verticalBorderHeight);
        }

        let rightBorder = "";

        if (showRightBorder) {
            const one = stylePiece(box.right, rightBorderColor, rightBorderBackgroundColor, dimRightBorderColor);

            rightBorder = `${one}\n`.repeat(verticalBorderHeight);
        }

        // ── Bottom border (with optional title) ────────────────────
        let bottomBorder: string | undefined;

        if (showBottomBorder) {
            const bottomLeftCorner = showLeftBorder ? stylePiece(box.bottomLeft, bottomBorderColor, bottomBorderBackgroundColor, dimBottomBorderColor) : "";
            const bottomRightCorner = showRightBorder ? stylePiece(box.bottomRight, bottomBorderColor, bottomBorderBackgroundColor, dimBottomBorderColor) : "";

            const bottomContent = buildBorderWithTitle(
                box.bottom,
                contentWidth,
                node.style.borderBottomTitle,
                node.style.borderBottomTitleAlignment,
                undefined,
                bottomBorderColor,
                bottomBorderBackgroundColor,
                dimBottomBorderColor,
            );

            bottomBorder = bottomLeftCorner + bottomContent + bottomRightCorner;
        }

        const offsetY = showTopBorder ? 1 : 0;

        if (topBorder) {
            output.write(x, y, topBorder, { transformers: [] });
        }

        if (leftBorder) {
            output.write(x, y + offsetY, leftBorder, { transformers: [] });
        }

        if (rightBorder) {
            output.write(x + width - 1, y + offsetY, rightBorder, {
                transformers: [],
            });
        }

        if (bottomBorder) {
            output.write(x, y + height - 1, bottomBorder, { transformers: [] });
        }
    }
};

export default renderBorder;
