/*
 * Part of the hand-written, performance-sensitive parser. The file-scope
 * disables mirror `loader.ts`: a single mutable `State` cursor is threaded
 * through every function (parameter reassignment), and scanning is done with
 * `charCodeAt` against a `0` EOF sentinel.
 */
/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/* eslint-disable no-cond-assign */
/* eslint-disable no-param-reassign */
/* eslint-disable no-useless-assignment */

/* eslint-disable unicorn/prefer-code-point */

/* eslint-disable sonarjs/cognitive-complexity */

/**
 * The four scalar readers: plain, single-quoted, double-quoted and block
 * (`|` / `>`).
 *
 * These are leaf parsers — none of them recurses back into the composer — which
 * is what lets them live outside `loader.ts` without an import cycle.
 */

import {
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
} from "./scanner";
import type { State } from "./state";
import { throwError } from "./state";

const CHOMPING_CLIP = 1;
const CHOMPING_STRIP = 2;
const CHOMPING_KEEP = 3;

const readPlainScalar = (state: State, nodeIndent: number, withinFlowCollection: boolean): boolean => {
    const previousKind = state.kind;
    const previousResult = state.result;
    const { input } = state;

    let ch = input.charCodeAt(state.position);

    if (isWsOrEol(ch) || isFlowIndicator(ch) || isPlainScalarLeadBlocker(ch)) {
        return false;
    }

    let following: number;

    if (ch === 0x3f || ch === 0x2d) {
        following = input.charCodeAt(state.position + 1);

        if (isWsOrEol(following) || (withinFlowCollection && isFlowIndicator(following))) {
            return false;
        }
    }

    state.kind = "scalar";
    state.result = "";

    let captureStart = state.position;
    let captureEnd = state.position;
    let hasPendingContent = false;
    let line = 0;
    let lineStart = 0;
    let lineIndent = 0;

    while (ch !== 0) {
        if (ch === 0x3a) {
            following = input.charCodeAt(state.position + 1);

            if (isWsOrEol(following) || (withinFlowCollection && isFlowIndicator(following))) {
                break;
            }
        } else if (ch === 0x23) {
            const preceding = input.charCodeAt(state.position - 1);

            if (isWsOrEol(preceding)) {
                break;
            }
        } else if ((state.position === state.lineStart && testDocumentSeparator(state)) || (withinFlowCollection && isFlowIndicator(ch))) {
            break;
        } else if (isEol(ch)) {
            line = state.line;
            lineStart = state.lineStart;
            lineIndent = state.lineIndent;

            skipSeparationSpace(state, false, -1);

            if (state.lineIndent >= nodeIndent) {
                hasPendingContent = true;
                ch = input.charCodeAt(state.position);
                continue;
            } else {
                state.position = captureEnd;
                state.line = line;
                state.lineStart = lineStart;
                state.lineIndent = lineIndent;
                break;
            }
        }

        if (hasPendingContent) {
            captureSegment(state, captureStart, captureEnd);
            writeFoldedLines(state, state.line - line);
            captureStart = state.position;
            captureEnd = state.position;
            hasPendingContent = false;
        }

        if (!isWhiteSpace(ch)) {
            captureEnd = state.position + 1;
        }

        ch = input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, captureEnd);

    if (state.result !== "") {
        return true;
    }

    state.kind = previousKind;
    state.result = previousResult;

    return false;
};

const readSingleQuotedScalar = (state: State, nodeIndent: number): boolean => {
    let ch = state.input.charCodeAt(state.position);

    if (ch !== 0x27) {
        return false;
    }

    state.kind = "scalar";
    state.result = "";
    state.position++;

    let captureStart = state.position;
    let captureEnd = state.position;

    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x27) {
            captureSegment(state, captureStart, state.position);
            ch = state.input.charCodeAt(++state.position);

            if (ch === 0x27) {
                captureStart = state.position;
                state.position++;
                captureEnd = state.position;
            } else {
                return true;
            }
        } else if (isEol(ch)) {
            captureSegment(state, captureStart, captureEnd);
            writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
            captureStart = state.position;
            captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
            throwError(state, "unexpected end of the document within a single quoted scalar");
        } else {
            // Trailing white space before a line break is folded away, so only
            // advance the captured end past non-space characters (§7.3.1).
            if (!isWhiteSpace(ch)) {
                captureEnd = state.position + 1;
            }

            state.position++;
        }
    }

    return throwError(state, "unexpected end of the stream within a single quoted scalar");
};

const readDoubleQuotedScalar = (state: State, nodeIndent: number): boolean => {
    let ch = state.input.charCodeAt(state.position);

    if (ch !== 0x22) {
        return false;
    }

    state.kind = "scalar";
    state.result = "";
    state.position++;

    let captureStart = state.position;
    let captureEnd = state.position;

    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x22) {
            captureSegment(state, captureStart, state.position);
            state.position++;

            return true;
        }

        if (ch === 0x5c) {
            captureSegment(state, captureStart, state.position);
            ch = state.input.charCodeAt(++state.position);

            if (isEol(ch)) {
                skipSeparationSpace(state, false, nodeIndent);
            } else if (ch < 256 && SIMPLE_ESCAPE[ch] !== undefined) {
                state.result = (state.result as string) + (SIMPLE_ESCAPE[ch] as string);
                state.position++;
            } else {
                const hexLength = escapedHexLength(ch);

                if (hexLength > 0) {
                    let remaining = hexLength;
                    let hexResult = 0;

                    for (; remaining > 0; remaining--) {
                        ch = state.input.charCodeAt(++state.position);

                        const digit = fromHexCode(ch);

                        if (digit >= 0) {
                            hexResult = (hexResult << 4) + digit;
                        } else {
                            throwError(state, "expected hexadecimal character");
                        }
                    }

                    state.result = (state.result as string) + String.fromCodePoint(hexResult);
                    state.position++;
                } else {
                    throwError(state, "unknown escape sequence");
                }
            }

            captureStart = state.position;
            captureEnd = state.position;
        } else if (isEol(ch)) {
            captureSegment(state, captureStart, captureEnd);
            writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
            captureStart = state.position;
            captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
            throwError(state, "unexpected end of the document within a double quoted scalar");
        } else {
            // Trailing white space before a line break is folded away, so only
            // advance the captured end past non-space characters (§7.3.1).
            if (!isWhiteSpace(ch)) {
                captureEnd = state.position + 1;
            }

            state.position++;
        }
    }

    return throwError(state, "unexpected end of the stream within a double quoted scalar");
};

const readBlockScalar = (state: State, nodeIndent: number): boolean => {
    let ch = state.input.charCodeAt(state.position);
    let folding: boolean;

    if (ch === 0x7c) {
        folding = false;
    } else if (ch === 0x3e) {
        folding = true;
    } else {
        return false;
    }

    state.kind = "scalar";
    state.result = "";

    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    // Largest indentation seen on a leading (pre-content) empty line — used only
    // in strict mode to reject a scalar whose leading blank lines are indented
    // more than its first content line (YAML 1.2 §8.1.1.1).
    let leadingEmptyIndent = 0;

    while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);

        if (ch === 0x2b || ch === 0x2d) {
            if (chomping === CHOMPING_CLIP) {
                chomping = ch === 0x2b ? CHOMPING_KEEP : CHOMPING_STRIP;
            } else {
                throwError(state, "repeat of a chomping mode identifier");
            }
        } else {
            const decimal = fromDecimalCode(ch);

            if (decimal >= 0) {
                if (decimal === 0) {
                    throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
                } else if (detectedIndent) {
                    throwError(state, "repeat of an indentation width identifier");
                } else {
                    textIndent = nodeIndent + decimal - 1;
                    detectedIndent = true;
                }
            } else {
                break;
            }
        }
    }

    if (isWhiteSpace(ch)) {
        do {
            ch = state.input.charCodeAt(++state.position);
        } while (isWhiteSpace(ch));

        if (ch === 0x23) {
            do {
                ch = state.input.charCodeAt(++state.position);
            } while (!isEol(ch) && ch !== 0);
        }
    }

    while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);

        while ((!detectedIndent || state.lineIndent < textIndent) && ch === 0x20) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
        }

        if (!detectedIndent && state.lineIndent > textIndent) {
            textIndent = state.lineIndent;
        }

        if (isEol(ch)) {
            // Remember the widest leading (pre-content) empty line so strict mode
            // can reject a first content line indented less than them (§8.1.1.1).
            if (!detectedIndent && state.lineIndent > leadingEmptyIndent) {
                leadingEmptyIndent = state.lineIndent;
            }

            emptyLines++;
            continue;
        }

        // Strict mode: a tab sitting in the block scalar's indentation (before
        // the content column is reached with spaces) is illegal — `foo: |\n\t\n`
        // is malformed, while `foo: |\n \t\n` (tab as content past one space of
        // indent) stays valid because there `lineIndent === textIndent`.
        if (state.options.strict && ch === 0x09 && state.lineIndent < textIndent) {
            throwError(state, "tab characters must not be used in indentation");
        }

        // End of the scalar: a genuine dedent, EOF, or a `---`/`...` document
        // marker at column 0. The last case matters only for a zero-indented
        // block scalar (textIndent 0), where `lineIndent < textIndent` can never
        // become true; an indented marker keeps `position > lineStart` and stays
        // scalar content.
        const atDocumentMarker = state.position === state.lineStart && testDocumentSeparator(state);

        // Strict mode: if the first content line is indented less than a leading
        // empty line, those empty lines were over-indented (`>` then `  \n   \n # x`)
        // — a spec error. Only fires for a real content line (not EOF / marker),
        // so an all-empty keep-chomped scalar (`|+\n   \n`) is unaffected.
        if (state.options.strict && ch !== 0 && !atDocumentMarker && !detectedIndent && leadingEmptyIndent > state.lineIndent) {
            throwError(state, "a block scalar's leading empty lines cannot be indented more than its content");
        }

        if (state.lineIndent < textIndent || ch === 0 || atDocumentMarker) {
            if (chomping === CHOMPING_KEEP) {
                state.result = (state.result as string) + "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
            } else if (chomping === CHOMPING_CLIP && didReadContent) {
                state.result = `${state.result as string}\n`;
            }

            break;
        }

        if (folding) {
            if (isWhiteSpace(ch)) {
                atMoreIndented = true;
                state.result = (state.result as string) + "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
            } else if (atMoreIndented) {
                atMoreIndented = false;
                state.result = (state.result as string) + "\n".repeat(emptyLines + 1);
            } else if (emptyLines === 0) {
                if (didReadContent) {
                    state.result = `${state.result as string} `;
                }
            } else {
                state.result = (state.result as string) + "\n".repeat(emptyLines);
            }
        } else {
            state.result = (state.result as string) + "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
        }

        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;

        const captureStart = state.position;

        while (!isEol(ch) && ch !== 0) {
            ch = state.input.charCodeAt(++state.position);
        }

        captureSegment(state, captureStart, state.position);
    }

    return true;
};

export { readBlockScalar, readDoubleQuotedScalar, readPlainScalar, readSingleQuotedScalar };
