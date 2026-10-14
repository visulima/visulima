/* eslint-disable e18e/prefer-static-regex */
import { truncate, wordWrap } from "@visulima/string";

import DataLimitedLruMap from "./data-limited-lru-map";
import type { Styles } from "./styles";

// Bounded so a long-running app streaming ever-changing text cannot grow it forever.
const cache = new DataLimitedLruMap<string>(10_000, 1_000_000);

const wrapWordMode: Record<string, string> = {
    hard: "STRICT_WIDTH",
    wrap: "BREAK_WORDS",
    "wrap-anywhere": "BREAK_AT_CHARACTERS",
    "wrap-preserve-words": "PRESERVE_WORDS",
    "wrap-strict": "STRICT_WIDTH",
};

const wrapText = (text: string, requestedWidth: number, wrapType: Styles["textWrap"]): string => {
    // Wrapping into zero columns would put every character on its own row and grow the layout to the
    // character count. Text with no room keeps its natural width, like any other content that does not fit.
    // Truncation is left alone: it cuts to nothing at zero columns.
    if (requestedWidth <= 0 && (wrapType === "wrap" || wrapType === "hard")) {
        return text;
    }

    // Yoga rounds a text node's width up to a whole column, so a positive fraction of a column is measured
    // as the one column it renders into.
    const maxWidth = requestedWidth > 0 && requestedWidth < 1 ? 1 : Math.floor(requestedWidth);

    // The separators keep (text, width) pairs such as ("a1", 2) and ("a", 12) from sharing a key.
    const cacheKey = `${String(maxWidth)}\u0000${String(wrapType)}\u0000${text}`;
    const cachedText = cache.get(cacheKey);

    if (cachedText !== undefined) {
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

        // Each line is truncated on its own; truncating the whole string would keep only the first line.
        wrappedText = text
            .split("\n")
            .map((line) => truncate(line, maxWidth, { position }))
            .join("\n");
    }

    cache.set(cacheKey, wrappedText);

    return wrappedText;
};

export default wrapText;
