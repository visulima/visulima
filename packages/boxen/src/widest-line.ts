
import stringWidth from "string-width";

// eslint-disable-next-line import/prefer-default-export
export const widestLine = (string: string): number => {
    let lineWidth = 0;

    // eslint-disable-next-line no-restricted-syntax
    for (const line of string.split("\n")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        lineWidth = Math.max(lineWidth, stringWidth(line) as number);
    }

    return lineWidth;
};
