import { getStringWidth } from "@visulima/string";

const cache = new Map<string, Output>();

type Output = {
    height: number;
    width: number;
};

const measureText = (text: string): Output => {
    if (text.length === 0) {
        return {
            height: 0,
            width: 0,
        };
    }

    const cachedDimensions = cache.get(text);

    if (cachedDimensions) {
        return cachedDimensions;
    }

    const width = Math.max(...text.split("\n").map((line) => getStringWidth(line)));
    const height = text.split("\n").length;
    const dimensions = { height, width };

    cache.set(text, dimensions);

    return dimensions;
};

export default measureText;
