// eslint-disable-next-line import/no-extraneous-dependencies
import stringWidth from "string-width";

type Options = {
    pad?: string;
    split?: string;
};

const baseAlign = (input: string, align: "center" | "right", options: Options = {}) => {
    let widthDiffFunction = (maxWidth: number, currentWidth: number) => Math.floor((maxWidth - currentWidth) / 2);

    if (align === "right") {
        widthDiffFunction = (maxWidth: number, currentWidth: number) => maxWidth - currentWidth;
    }

    const pad = options.pad ?? " ";
    const split = options.split ?? "\n";
    const splitText = input.split(split);

    let width;
    let maxWidth = 0;

    return splitText
        .map((string_: string) => {
            width = stringWidth(string_);
            maxWidth = Math.max(width, maxWidth);

            return {
                str: string_,
                width,
            };
        })
        .map((object: { str: string; width: number }) => Array.from({ length: widthDiffFunction(maxWidth, object.width) + 1 }).join(pad) + object.str)
        .join(split);
};

const align = {
    center: (input: string, options: Options = {}): string => baseAlign(input, "center", options),
    right: (input: string, options: Options = {}): string => baseAlign(input, "right", options),
};

export default align;
