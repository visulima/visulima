/**
 * This file is ported from https://github.com/nexdrew/ansi-align into typescript.
 *
 * Copyright (c) 2016, Contributors
 */
import type { StringWidthOptions } from "./get-string-width";
import { getStringWidth } from "./get-string-width";

const halfDiff = (maxWidth: number, currentWidth: number): number => Math.floor((maxWidth - currentWidth) / 2);

const fullDiff = (maxWidth: number, currentWidth: number): number => maxWidth - currentWidth;

/**
 * Options for controlling the text alignment.
 */
export type AlignTextOptions = {
    /**
     * The alignment direction.
     * @default "center"
     */
    align?: "center" | "left" | "right";
    /**
     * The character to use for padding.
     * @default " "
     */
    pad?: string;
    /**
     * The character to split the input string by, if it's a single string.
     * @default "\n"
     */
    split?: string;
    /**
     * Options to pass to `getStringWidth` for calculating the width of each line.
     */
    stringWidthOptions?: StringWidthOptions;
};

/**
 * Aligns text (including multi-line strings with ANSI escape codes) to the left, center, or right.
 *
 * @example
 * ```typescript
 * alignText("Hello\nWorld!", { align: "right" });
 * // => " Hello\nWorld!"
 *
 * alignText(["Beep", "Boop\nBop"], { align: "center" });
 * // => [
 * //   " Beep",
 * //   "Boop\n Bop"
 * // ]
 * ```
 *
 * @param text - The string or array of strings to align.
 * @param options - Options for controlling the alignment.
 * @returns The aligned string or array of strings, matching the input type.
 */
export const alignText = (
    text: string[] | string,
    options: AlignTextOptions = {},
): string[] | string => {
    const align = options.align ?? "center";

    // short-circuit `align: 'left'` as no-op
    if (align === "left") {
        return text;
    }

    const split = options.split ?? "\n";
    const pad = options.pad ?? " ";
    const widthDiffFunction = align === "right" ? fullDiff : halfDiff;

    let returnString = false;

    if (!Array.isArray(text)) {
        returnString = true;

        // eslint-disable-next-line no-param-reassign
        text = String(text).split(split);
    }

    let width: number;
    let maxWidth = 0;

    // eslint-disable-next-line no-param-reassign
    text = text
        .map((input) => {
            // eslint-disable-next-line no-param-reassign
            input = String(input);
            width = getStringWidth(input, options.stringWidthOptions);
            maxWidth = Math.max(width, maxWidth);

            return {
                str: input,
                width,
            };
        })
        .map((object) => Array.from({ length: widthDiffFunction(maxWidth, object.width) + 1 }).join(pad) + object.str);

    return returnString ? text.join(split) : text;
};
