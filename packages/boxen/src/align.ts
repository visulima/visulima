/**
 * This file is ported from https://github.com/nexdrew/ansi-align into typescript.
 *
 * Copyright (c) 2016, Contributors
 */

import stringWidth from "string-width";

const halfDiff = (maxWidth: number, currentWidth: number): number => Math.floor((maxWidth - currentWidth) / 2);

const fullDiff = (maxWidth: number, currentWidth: number): number => maxWidth - currentWidth;

export const alignAnsi = (
    text: string[] | string,
    options: {
        align?: "center" | "left" | "right";
        pad?: string;
        split?: string;
    } = {},
): string[] | string => {
    const align = options.align || "center";

    // short-circuit `align: 'left'` as no-op
    if (align === "left") {
        return text;
    }

    const split = options.split || "\n";
    const pad = options.pad || " ";
    const widthDiffFunction = align === "right" ? fullDiff : halfDiff;

    let returnString = false;

    if (!Array.isArray(text)) {
        returnString = true;

        text = String(text).split(split);
    }

    let width;
    let maxWidth = 0;

    text = text
        .map((string_) => {
            string_ = String(string_);
            width = stringWidth(string_);
            maxWidth = Math.max(width, maxWidth);
            return {
                str: string_,
                width,
            };
        })
        .map((object) => new Array(widthDiffFunction(maxWidth, object.width) + 1).join(pad) + object.str);

    return returnString ? text.join(split) : text;
};
