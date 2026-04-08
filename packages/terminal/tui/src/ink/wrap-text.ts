/* eslint-disable e18e/prefer-static-regex */
import { truncate, wordWrap } from "@visulima/string";

import type { Styles } from "./styles";

const cache: Record<string, string> = {};

const wrapWordMode: Record<string, string> = {
    hard: "STRICT_WIDTH",
    wrap: "BREAK_WORDS",
    "wrap-anywhere": "BREAK_AT_CHARACTERS",
    "wrap-preserve-words": "PRESERVE_WORDS",
    "wrap-strict": "STRICT_WIDTH",
};

const wrapText = (text: string, maxWidth: number, wrapType: Styles["textWrap"]): string => {
    const cacheKey = text + String(maxWidth) + String(wrapType);
    const cachedText = cache[cacheKey];

    if (cachedText) {
        return cachedText;
    }

    let wrappedText = text;
    const wordMode = wrapWordMode[wrapType!];

    if (wordMode) {
        wrappedText = wordWrap(text, {
            trim: false,
            width: maxWidth,
            wrapMode: wordMode as "BREAK_AT_CHARACTERS" | "BREAK_WORDS" | "PRESERVE_WORDS" | "STRICT_WIDTH",
        }).replace(/\n$/, "");
    } else if (wrapType!.startsWith("truncate")) {
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
