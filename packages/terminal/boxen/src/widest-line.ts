// eslint-disable-next-line import/no-extraneous-dependencies
import { getStringWidth } from "@visulima/string";

// eslint-disable-next-line import/prefer-default-export
export const widestLine = (string: string): number => {
    let lineWidth = 0;

    for (const line of string.split("\n")) {
        lineWidth = Math.max(lineWidth, getStringWidth(line));
    }

    return lineWidth;
};
