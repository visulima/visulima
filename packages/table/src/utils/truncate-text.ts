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
        const length = stringWidth(line);

        if (length <= maxWidth) {
            return line;
        }

        if (options.position === "start") {
            if (options.space) {
                truncationCharacter += " ";
            }

            const truncCharWidth = stringWidth(truncationCharacter);
            const targetWidth = maxWidth - truncCharWidth;
            const startPos = findRealPosition(line, length - targetWidth);

            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, startPos, true);
                const truncated = preserveAnsiCodes(line, nearestSpace, length).trim();
                return truncationCharacter + truncated;
            }

            const truncated = preserveAnsiCodes(line, startPos, length);
            return truncationCharacter + truncated;
        }

        if (options.position === "middle") {
            if (options.space) {
                truncationCharacter = ` ${truncationCharacter} `;
            }

            const truncCharWidth = stringWidth(truncationCharacter);
            const targetHalfWidth = Math.floor((maxWidth - truncCharWidth) / 2);
            const remainingWidth = maxWidth - targetHalfWidth - truncCharWidth;

            const firstBreakPoint = findRealPosition(line, targetHalfWidth);
            const secondBreakPoint = findRealPosition(line, length - remainingWidth);

            if (options.preferTruncationOnSpace) {
                const spaceNearFirstBreak = getIndexOfNearestSpace(line, firstBreakPoint);
                const spaceNearSecondBreak = getIndexOfNearestSpace(
                    line,
                    secondBreakPoint,
                    true,
                );

                const firstPart = preserveAnsiCodes(line, 0, spaceNearFirstBreak);
                const secondPart = preserveAnsiCodes(line, spaceNearSecondBreak, length).trim();

                return firstPart + truncationCharacter + secondPart;
            }

            const firstPart = preserveAnsiCodes(line, 0, firstBreakPoint);
            const secondPart = preserveAnsiCodes(line, secondBreakPoint, length);

            return firstPart + truncationCharacter + secondPart;
        }

        // Default: end position
        if (options.space) {
            truncationCharacter = ` ${truncationCharacter}`;
        }

        const truncCharWidth = stringWidth(truncationCharacter);
        const targetWidth = maxWidth - truncCharWidth;
        const endPos = findRealPosition(line, targetWidth);

        if (options.preferTruncationOnSpace) {
            const nearestSpace = getIndexOfNearestSpace(line, endPos);
            const truncated = preserveAnsiCodes(line, 0, nearestSpace);
            return truncated + truncationCharacter;
        }

        const truncated = preserveAnsiCodes(line, 0, endPos);
        return truncated + truncationCharacter;
    });

    return truncatedLines.join("\n");
};
