import { bench, describe } from "vitest";

import { ANSI_ESCAPE_LINK, ESCAPES } from "../src/constants";
import { checkEscapeSequence } from "../src/utils/ansi-parser";
import { wordWrap, WrapMode } from "../src/word-wrap";

/**
 * Builds a string that is dense in ANSI escape sequences. The previous
 * implementation called `checkEscapeSequence([...string], index)` for *every*
 * escape character encountered, spreading the entire string into a codepoint
 * array each time (O(n) per escape -> O(n^2) overall). The current code inlines
 * a `string.startsWith(ANSI_ESCAPE_LINK, index + 1)` check instead.
 */
const buildEscapeHeavy = (segments: number): string => {
    let out = "";

    for (let index = 0; index < segments; index += 1) {
        // Alternate SGR color codes and OSC-8 hyperlinks to exercise both branches.
        out += `[3${index % 8}mword${index} `;
        out += `]8;;https://example.com/${index}link${index}]8;; `;
    }

    return out;
};

const escapeHeavy = buildEscapeHeavy(400);

// Standalone re-implementations of the two per-escape link checks, exercised over
// the whole string the way wrapWithBreakAtWidth does, to isolate the hot loop.
const scanWithSpread = (string: string): number => {
    const chars = [...string];
    let count = 0;

    for (let index = 0; index < string.length; index += 1) {
        if (ESCAPES.has(string[index] as string)) {
            // eslint-disable-next-line @typescript-eslint/no-misused-spread -- mirrors the previous code path
            const info = checkEscapeSequence([...string], index);

            if (info.isInsideLinkEscape) {
                count += 1;
            }
        }
    }

    return count + chars.length * 0;
};

const scanWithStartsWith = (string: string): number => {
    let count = 0;

    for (let index = 0; index < string.length; index += 1) {
        if (ESCAPES.has(string[index] as string)) {
            if (string.startsWith(ANSI_ESCAPE_LINK, index + 1)) {
                count += 1;
            }
        }
    }

    return count;
};

describe("word-wrap escape scan (startsWith vs full-string spread)", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("current (startsWith, no spread)", () => {
        scanWithStartsWith(escapeHeavy);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("legacy (checkEscapeSequence with [...string] per escape)", () => {
        scanWithSpread(escapeHeavy);
    });

    // End-to-end: the optimization lives inside wrapWithBreakAtWidth (STRICT_WIDTH).
    bench.skipIf(process.env.CODSPEED_ENV)("wordWrap STRICT_WIDTH on escape-heavy text", () => {
        wordWrap(escapeHeavy, { width: 40, wrapMode: WrapMode.STRICT_WIDTH });
    });
});
