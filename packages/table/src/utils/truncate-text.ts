import stringWidth from "string-width";

import type { TruncateOptions } from "../types";
import { findRealPosition } from "./find-real-position";
import { getIndexOfNearestSpace } from "./get-index-of-nearest-space";
import { preserveAnsiCodes } from "./preserve-ansi-codes";

/** Truncates text to a specified width, handling ANSI codes. */
export const truncateText = (text: string, maxWidth: number, options: Required<TruncateOptions>): string => {
    if (maxWidth < 1) {
        return "";
    }

    if (maxWidth === 1) {
        return options.truncationCharacter;
    }

    const lines = text.split("\n");
    let { truncationCharacter } = options;

    const truncatedLines = lines.map((line) => {
        const visibleWidth = stringWidth(line);
        if (visibleWidth <= maxWidth) {
            return line;
        }

        // Calculate extra space count if option.space is true
        const extraSpace = options.space ? (options.position === "middle" ? 2 : 1) : 0;
        const truncCharWidth = stringWidth(truncationCharacter) + extraSpace;

        if (options.position === "start") {
            if (options.space) {
                truncationCharacter += " ";
            }
            const targetWidth = maxWidth - truncCharWidth;
            const startPos = findRealPosition(line, visibleWidth - targetWidth);
            let breakPoint = startPos;
            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, startPos, true);
                if (nearestSpace !== -1) {
                    breakPoint = nearestSpace;
                }
            }
            const truncated = preserveAnsiCodes(line, breakPoint, line.length).trim();
            return truncationCharacter + truncated;
        }

        if (options.position === "middle") {
            if (options.space) {
                truncationCharacter = ` ${truncationCharacter} `;
            }
            const targetTotal = maxWidth - stringWidth(truncationCharacter);
            const leftTarget = Math.floor(targetTotal / 2);
            const rightTarget = targetTotal - leftTarget;
            const leftBreak = findRealPosition(line, leftTarget);
            const rightBreak = findRealPosition(line, visibleWidth - rightTarget);
            let leftPart = preserveAnsiCodes(line, 0, leftBreak);
            let rightPart = preserveAnsiCodes(line, rightBreak, line.length);

            if (options.preferTruncationOnSpace) {
                const leftSpace = getIndexOfNearestSpace(line, leftBreak, false);
                if (leftSpace !== -1) {
                    leftPart = preserveAnsiCodes(line, 0, leftSpace);
                }
                const rightSpace = getIndexOfNearestSpace(line, rightBreak, true);
                if (rightSpace !== -1) {
                    rightPart = preserveAnsiCodes(line, rightSpace, line.length).trim();
                }
            }
            return leftPart + truncationCharacter + rightPart;
        }

        // Default: end truncation
        if (options.space) {
            truncationCharacter = ` ${truncationCharacter}`;
        }
        const targetWidth = maxWidth - truncCharWidth;
        const endPos = findRealPosition(line, targetWidth);
        let breakPoint = endPos;
        if (options.preferTruncationOnSpace) {
            const nearestSpace = getIndexOfNearestSpace(line, endPos);
            if (nearestSpace !== -1) {
                breakPoint = nearestSpace;
            }
        }
        const truncated = preserveAnsiCodes(line, 0, breakPoint);
        return truncated + truncationCharacter;
    });

    return truncatedLines.join("\n");
};
