/**
 * This file is ported from https://github.com/nexdrew/ansi-align into typescript.
 *
 * Copyright (c) 2016, Contributors
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";

const halfDiff = (maxWidth: number, currentWidth: number): number => Math.floor((maxWidth - currentWidth) / 2);

const fullDiff = (maxWidth: number, currentWidth: number): number => maxWidth - currentWidth;

// eslint-disable-next-line import/prefer-default-export
export const alignAnsi = (
    text: string[] | string,
    options: {
        align?: "center" | "left" | "right";
        pad?: string;
        split?: string;
    } = {},
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

    let width;
    let maxWidth = 0;

    // eslint-disable-next-line no-param-reassign
    text = text
        .map((string_) => {
            // eslint-disable-next-line no-param-reassign
            string_ = String(string_);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call
            width = stringWidth(string_);

            maxWidth = Math.max(width as number, maxWidth);

            return {
                str: string_,
                width: width as number,
            };
        })
        .map((object) => Array.from({ length: widthDiffFunction(maxWidth, object.width) + 1 }).join(pad) + object.str);

    return returnString ? text.join(split) : text;
};
