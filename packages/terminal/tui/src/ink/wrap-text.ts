// eslint-disable-next-line import/no-extraneous-dependencies
import { truncate, wordWrap } from "@visulima/string";
import { type Styles } from "./styles.js";

const cache: Record<string, string> = {};

const wrapText = (text: string, maxWidth: number, wrapType: Styles["textWrap"]): string => {
    const cacheKey = text + String(maxWidth) + String(wrapType);
    const cachedText = cache[cacheKey];

    if (cachedText) {
        return cachedText;
    }

    let wrappedText = text;

    if (wrapType === "wrap") {
        wrappedText = wordWrap(text, {
            width: maxWidth,
            trim: false,
            wrapMode: "BREAK_WORDS",
        }).replace(/\n$/, "");
    }

    if (wrapType!.startsWith("truncate")) {
        let position: "end" | "middle" | "start" = "end";

        if (wrapType === "truncate-middle") {
            position = "middle";
        }

        if (wrapType === "truncate-start") {
            position = "start";
        }

        wrappedText = truncate(text, maxWidth, { position });
    }

    cache[cacheKey] = wrappedText;

    return wrappedText;
};

export default wrapText;
