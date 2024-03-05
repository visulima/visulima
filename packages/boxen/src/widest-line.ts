// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";

export const widestLine = (string: string): number => {
    let lineWidth = 0;

    for (const line of string.split("\n")) {
        lineWidth = Math.max(lineWidth, stringWidth(line));
    }

    return lineWidth;
};
