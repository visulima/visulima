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

    const visibleLength = stringWidth(text);

    if (visibleLength <= maxWidth) {
        return text;
    }

    const lines = text.split("\n");

    let { truncationCharacter } = options;

    const truncatedLines = lines.map((line) => {
        const lineLength = stringWidth(line);

        if (lineLength <= maxWidth) {
            return line;
        }

        if (options.position === "start") {
            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, lineLength - maxWidth + 1, true);
                return truncationCharacter + preserveAnsiCodes(line, nearestSpace, line.length).trim();
            }

            if (options.space) {
                truncationCharacter += " ";
            }

            const visibleStart = stringWidth(line) - maxWidth + stringWidth(truncationCharacter);
            const realStart = findRealPosition(line, visibleStart);

            return truncationCharacter + preserveAnsiCodes(line, realStart, line.length);
        }

        if (options.position === "middle") {
            if (options.space) {
                truncationCharacter = ` ${truncationCharacter} `;
            }

            const halfWidth = Math.floor(maxWidth / 2);

            if (options.preferTruncationOnSpace) {
                const spaceNearFirst = getIndexOfNearestSpace(line, halfWidth);
                const spaceNearSecond = getIndexOfNearestSpace(line, line.length - (maxWidth - halfWidth) + 1, true);

                return preserveAnsiCodes(line, 0, spaceNearFirst) + truncationCharacter + preserveAnsiCodes(line, spaceNearSecond, line.length).trim();
            }

            const firstHalf = findRealPosition(line, halfWidth);
            const secondHalfStart = stringWidth(line) - (maxWidth - halfWidth) + stringWidth(truncationCharacter);
            const secondHalf = findRealPosition(line, secondHalfStart);

            return preserveAnsiCodes(line, 0, firstHalf) + truncationCharacter + preserveAnsiCodes(line, secondHalf, line.length);
        }

        if (options.position === "end") {
            if (options.preferTruncationOnSpace) {
                const nearestSpace = getIndexOfNearestSpace(line, maxWidth - 1);

                return preserveAnsiCodes(line, 0, nearestSpace) + truncationCharacter;
            }

            if (options.space) {
                truncationCharacter = ` ${truncationCharacter}`;
            }

            const realEnd = findRealPosition(line, maxWidth - stringWidth(truncationCharacter));

            return preserveAnsiCodes(line, 0, realEnd) + truncationCharacter;
        }

        throw new Error(`Expected options.position to be either 'start', 'middle' or 'end', got ${options.position}`);
    });

    return truncatedLines.join("\n");
};
