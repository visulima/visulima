import stringWidth from "string-width";

import type { HorizontalAlign } from "./types";

/**
 * Returns the first defined value from the arguments
 */
export const firstDefined = (...arguments_: unknown[]): unknown => arguments_.find((v) => v !== undefined && v !== null);

/**
 * Sets an option in the target object based on two source objects
 */
export const setOption = (objectA: Record<string, unknown>, objectB: Record<string, unknown>, nameB: string, targetObject: Record<string, unknown>): void => {
    const nameA = nameB.split("-");
    if (nameA.length > 1) {
        nameA[1] = nameA[1].charAt(0).toUpperCase() + nameA[1].slice(1);
        const camelCaseName = nameA.join("");
        targetObject[camelCaseName] = firstDefined(objectA[camelCaseName], objectA[nameB], objectB[camelCaseName], objectB[nameB]);
    } else {
        targetObject[nameB] = firstDefined(objectA[nameB], objectB[nameB]);
    }
};

/**
 * Calculates the dimension (width or height) for a cell spanning multiple rows/columns.
 * @param dimensions Array of dimensions (widths or heights)
 * @param start Starting index in the dimensions array
 * @param span Number of dimensions to span
 * @returns Total dimension
 */
export const findDimension = (dimensions: number[], start: number, span: number): number => {
    let dimension = 0;
    for (let index = 0; index < span; index++) {
        dimension += dimensions[start + index] ?? 0;
    }
    return dimension;
};

/**
 * Sums two numbers and adds 1
 */
export const sumPlusOne = (a: number, b: number): number => a + b + 1;

/**
 * Repeats a string a specified number of times.
 * @param str String to repeat
 * @param times Number of times to repeat
 * @returns Repeated string
 */
export const repeat = (string_: string, times: number): string => string_.repeat(times);

/**
 * Truncates a string to a specified width, optionally adding an ellipsis.
 * @param str String to truncate
 * @param width Maximum width
 * @param truncate Optional string to append when truncating (e.g., '...')
 * @returns Truncated string
 */
export const truncate = (string_: string, width: number, truncate = ""): string => {
    const stringWidth_ = stringWidth(string_);
    if (stringWidth_ <= width) {
        return string_;
    }

    const truncateWidth = stringWidth(truncate);
    if (truncateWidth > width) {
        return string_.slice(0, width);
    }

    let result = "";
    let currentWidth = 0;
    const chars = [...string_];

    for (const char of chars) {
        const charWidth = stringWidth(char);
        if (currentWidth + charWidth + truncateWidth > width) {
            break;
        }
        result += char;
        currentWidth += charWidth;
    }

    return result + truncate;
};

/**
 * Pads a string to a specified width with alignment.
 * @param str String to pad
 * @param width Target width
 * @param char Character to use for padding
 * @param align Horizontal alignment (left, right, center)
 * @returns Padded string
 */
export const pad = (string_: string, width: number, char = " ", align: HorizontalAlign = "left"): string => {
    const stringWidth_ = stringWidth(string_);
    const padWidth = Math.max(0, width - stringWidth_);

    switch (align) {
        case "right": {
            return repeat(char, padWidth) + string_;
        }
        case "center": {
            const leftPadWidth = Math.floor(padWidth / 2);
            const rightPadWidth = padWidth - leftPadWidth;
            return repeat(char, leftPadWidth) + string_ + repeat(char, rightPadWidth);
        }
        default: {
            return string_ + repeat(char, padWidth);
        }
    }
};

/**
 * Wraps text to fit within a specified width, optionally breaking only at word boundaries.
 * @param width Maximum width
 * @param text Text to wrap
 * @param wrapOnWordBoundary Whether to wrap only at word boundaries
 * @returns Array of wrapped lines
 */
export const wordWrap = (width: number, text: string, wrapOnWordBoundary = true): string[] => {
    if (width < 1) {
        return [text];
    }

    const lines: string[] = [];
    let line = "";
    let lineWidth = 0;
    const words = wrapOnWordBoundary ? text.split(/\s+/) : [...text];

    for (const word of words) {
        const wordWidth = stringWidth(word);

        if (lineWidth + wordWidth + (lineWidth > 0 ? 1 : 0) <= width) {
            if (lineWidth > 0) {
                line += " ";
                lineWidth += 1;
            }
            line += word;
            lineWidth += wordWidth;
        } else {
            if (line) {
                lines.push(line);
            }
            line = word;
            lineWidth = wordWidth;
        }
    }

    if (line) {
        lines.push(line);
    }

    return lines;
};
