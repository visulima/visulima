/*
 * Part of the hand-written, performance-sensitive parser. The file-scope
 * disables mirror `loader.ts`: a single mutable `State` cursor is threaded
 * through every function (parameter reassignment), and scanning is done with
 * `charCodeAt` against a `0` EOF sentinel.
 */
/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * Character classification and the low-level cursor moves shared by the scalar
 * readers and the composer: capturing a slice, folding line breaks, consuming a
 * line break, skipping separation space, and recognising a document marker.
 *
 * The predicates are deliberately written as `charCodeAt` comparisons rather
 * than regexes or `Set` lookups — they run once per input character.
 */

import type { State } from "./state";
import { throwError } from "./state";

const isEol = (c: number): boolean => c === 0x0a || c === 0x0d;
const isWhiteSpace = (c: number): boolean => c === 0x09 || c === 0x20;
const isWsOrEol = (c: number): boolean => c === 0x09 || c === 0x20 || c === 0x0a || c === 0x0d || c === 0;
const isFlowIndicator = (c: number): boolean => c === 0x2c || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d;

// `# & * ! | > ' " % @ \`` — none of these may begin a plain scalar. A 128-entry
// lookup table is faster than `Set.has` on the scalar hot path.
const PLAIN_SCALAR_LEAD_BLOCKERS = new Uint8Array(128);

for (const code of [0x21, 0x22, 0x23, 0x25, 0x26, 0x27, 0x2a, 0x3e, 0x40, 0x60, 0x7c]) {
    PLAIN_SCALAR_LEAD_BLOCKERS[code] = 1;
}

const isPlainScalarLeadBlocker = (c: number): boolean => c < 128 && PLAIN_SCALAR_LEAD_BLOCKERS[c] === 1;

const fromHexCode = (c: number): number => {
    if (c >= 0x30 && c <= 0x39) {
        return c - 0x30;
    }

    const lc = c | 0x20;

    if (lc >= 0x61 && lc <= 0x66) {
        return lc - 0x61 + 10;
    }

    return -1;
};

const fromDecimalCode = (c: number): number => {
    if (c >= 0x30 && c <= 0x39) {
        return c - 0x30;
    }

    return -1;
};

const SIMPLE_ESCAPE: (string | undefined)[] = Array.from({ length: 256 });

SIMPLE_ESCAPE[0x30] = "\0";
SIMPLE_ESCAPE[0x61] = "\u0007";
SIMPLE_ESCAPE[0x62] = "\b";
SIMPLE_ESCAPE[0x74] = "\t";
SIMPLE_ESCAPE[0x09] = "\t";
SIMPLE_ESCAPE[0x6e] = "\n";
SIMPLE_ESCAPE[0x76] = "\v";
SIMPLE_ESCAPE[0x66] = "\f";
SIMPLE_ESCAPE[0x72] = "\r";
SIMPLE_ESCAPE[0x65] = "\u001B";
SIMPLE_ESCAPE[0x20] = " ";
SIMPLE_ESCAPE[0x22] = "\u0022";
SIMPLE_ESCAPE[0x2f] = "/";
SIMPLE_ESCAPE[0x5c] = "\\";
SIMPLE_ESCAPE[0x4e] = "\u0085";
SIMPLE_ESCAPE[0x5f] = "\u00A0";
SIMPLE_ESCAPE[0x4c] = "\u2028";
SIMPLE_ESCAPE[0x50] = "\u2029";

const escapedHexLength = (c: number): number => {
    switch (c) {
        case 0x55: {
            return 8;
        }
        case 0x75: {
            return 4;
        }
        case 0x78: {
            return 2;
        }
        default: {
            return 0;
        }
    }
};

const captureSegment = (state: State, start: number, end: number): void => {
    if (start < end) {
        state.result = (state.result as string) + state.input.slice(start, end);
    }
};

const writeFoldedLines = (state: State, count: number): void => {
    if (count === 1) {
        state.result = `${state.result as string} `;
    } else if (count > 1) {
        state.result = (state.result as string) + "\n".repeat(count - 1);
    }
};

const readLineBreak = (state: State): void => {
    const ch = state.input.charCodeAt(state.position);

    if (ch === 0x0a) {
        state.position++;
    } else if (ch === 0x0d) {
        state.position++;

        if (state.input.charCodeAt(state.position) === 0x0a) {
            state.position++;
        }
    } else {
        throwError(state, "a line break is expected");
    }

    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
    state.lineCounter?.addNewLine(state.position);
};

const skipSeparationSpace = (state: State, allowComments: boolean, checkIndent: number): number => {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        while (isWhiteSpace(ch)) {
            if (ch === 0x09 && state.firstTabInLine === -1) {
                state.firstTabInLine = state.position;
            }

            ch = state.input.charCodeAt(++state.position);
        }

        if (allowComments && ch === 0x23) {
            // A `#` only begins a comment when preceded by white space, a line
            // break, or the start of a line. `]#c`, `"v"#c`, `a,#c` are therefore
            // malformed rather than commented — this matches the `yaml` reference
            // (js-yaml is lenient and silently accepts them).
            const preceding = state.position === state.lineStart ? 0x0a : state.input.charCodeAt(state.position - 1);

            if (!isWsOrEol(preceding)) {
                throwError(state, "a comment must be separated from other tokens by white space characters");
            }

            do {
                ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0x0a && ch !== 0x0d && ch !== 0);
        }

        if (isEol(ch)) {
            readLineBreak(state);

            ch = state.input.charCodeAt(state.position);
            lineBreaks++;
            state.lineIndent = 0;

            while (ch === 0x20) {
                state.lineIndent++;
                ch = state.input.charCodeAt(++state.position);
            }
        } else {
            break;
        }
    }

    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwError(state, "deficient indentation");
    }

    return lineBreaks;
};

const testDocumentSeparator = (state: State): boolean => {
    let { position } = state;
    let ch = state.input.charCodeAt(position);

    if ((ch === 0x2d || ch === 0x2e) && ch === state.input.charCodeAt(position + 1) && ch === state.input.charCodeAt(position + 2)) {
        position += 3;
        ch = state.input.charCodeAt(position);

        if (ch === 0 || isWsOrEol(ch)) {
            return true;
        }
    }

    return false;
};

export {
    captureSegment,
    escapedHexLength,
    fromDecimalCode,
    fromHexCode,
    isEol,
    isFlowIndicator,
    isPlainScalarLeadBlocker,
    isWhiteSpace,
    isWsOrEol,
    readLineBreak,
    SIMPLE_ESCAPE,
    skipSeparationSpace,
    testDocumentSeparator,
    writeFoldedLines,
};
