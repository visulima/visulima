/*
 * This is a hand-written, performance-sensitive scanner. Several lint rules are
 * disabled at file scope because they conflict with the parser's design: a
 * single mutable `State` cursor is threaded through every function (parameter
 * reassignment), `charCodeAt` is used deliberately for byte-level scanning with
 * a `0` EOF sentinel, and YAML's `null` is a first-class value in the output.
 */
/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/* eslint-disable no-cond-assign */
/* eslint-disable no-useless-assignment */
/* eslint-disable sonarjs/no-dead-store */
/* eslint-disable sonarjs/no-redundant-assignments */
/* eslint-disable no-param-reassign */
/* eslint-disable sonarjs/different-types-comparison */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * Recursive-descent YAML 1.2 loader.
 *
 * The overall control flow (document → node → collection/scalar) follows the
 * well-trodden structure used by mature YAML implementations: a single mutable
 * cursor walks the source string, indentation columns are threaded through the
 * block parsers, and native JavaScript values are produced directly (there is
 * no intermediate concrete syntax tree on the default path).
 */

import { YAMLParseError, YAMLWarning } from "../errors";
import { resolveExplicitTag, resolveScalarValue } from "../schema/resolve-scalar";
import type { ParseOptions } from "../types";

const CONTEXT_FLOW_IN = 1;
const CONTEXT_FLOW_OUT = 2;
const CONTEXT_BLOCK_IN = 3;
const CONTEXT_BLOCK_OUT = 4;

const CHOMPING_CLIP = 1;
const CHOMPING_STRIP = 2;
const CHOMPING_KEEP = 3;

const MERGE_TAG = "tag:yaml.org,2002:merge";

const YAML_VERSION_RE = /^\d+\.\d+$/;

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

const isPlainObject = (value: unknown): boolean => typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]";

const hasOwn = (object: object, key: PropertyKey): boolean => Object.hasOwn(object, key);

/** The mutable parser cursor + accumulators. */
class State {
    public input: string;

    public length: number;

    public position = 0;

    public line = 0;

    public lineStart = 0;

    public lineIndent = 0;

    public documents: unknown[] = [];

    public tag: string | null = null;

    public anchor: string | null = null;

    public kind: string | null = null;

    public result: unknown = null;

    public plainScalar = false;

    public anchorMap = new Map<string, unknown>();

    public tagMap = new Map<string, string>();

    public aliasCount = 0;

    public readonly options: ParseOptions & Required<Pick<ParseOptions, "duplicateKeys" | "maxAliasCount" | "preventProtoPollution">>;

    public constructor(input: string, options: ParseOptions) {
        this.input = input;
        this.length = input.length;
        this.options = {
            duplicateKeys: options.duplicateKeys ?? "error",
            maxAliasCount: options.maxAliasCount ?? 100,
            preventProtoPollution: options.preventProtoPollution ?? true,
            ...options,
        };
    }
}

const makeError = (state: State, message: string): YAMLParseError =>
    new YAMLParseError(
        message,
        {
            column: state.position - state.lineStart,
            line: state.line,
            position: state.position,
        },
        state.input,
    );

const throwError = (state: State, message: string): never => {
    throw makeError(state, message);
};

const emitWarning = (state: State, message: string): void => {
    if (state.options.onWarning) {
        state.options.onWarning(
            new YAMLWarning(
                message,
                {
                    column: state.position - state.lineStart,
                    line: state.line,
                    position: state.position,
                },
                state.input,
            ),
        );
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
};

const skipSeparationSpace = (state: State, allowComments: boolean, checkIndent: number): number => {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
        }

        if (allowComments && ch === 0x23) {
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
        emitWarning(state, "deficient indentation");
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

const mergeMappings = (state: State, destination: Record<string, unknown>, source: unknown, overridableKeys: Set<string>): void => {
    if (!isPlainObject(source)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }

    for (const key of Object.keys(source as Record<string, unknown>)) {
        if (!hasOwn(destination, key)) {
            destination[key] = (source as Record<string, unknown>)[key];
            overridableKeys.add(key);
        }
    }
};

/**
 * Store one key/value pair into `result`, honouring merge keys, duplicate-key
 * policy and the prototype-pollution guard. `overridableKeys` tracks keys that
 * a merge introduced (so a later explicit key may override them); it is created
 * lazily — merge keys are rare, so a merge-free mapping never allocates a Set.
 * Returns the (possibly newly created) `overridableKeys` set.
 */
const storeMappingPair = (
    state: State,
    result: Record<string, unknown>,
    overridableKeys: Set<string> | undefined,
    keyTag: string | null,
    keyNodeInput: unknown,
    valueNode: unknown,
): Set<string> | undefined => {
    let keyNode = keyNodeInput;
    let keys = overridableKeys;

    // Flatten complex keys into strings — plain objects can only carry string keys.
    if (Array.isArray(keyNode)) {
        keyNode = [...(keyNode as unknown[])];

        for (let index = 0; index < (keyNode as unknown[]).length; index++) {
            if (Array.isArray((keyNode as unknown[])[index])) {
                throwError(state, "nested arrays are not supported inside keys");
            }

            if (isPlainObject((keyNode as unknown[])[index])) {
                (keyNode as unknown[])[index] = "[object Object]";
            }
        }
    }

    if (isPlainObject(keyNode)) {
        keyNode = "[object Object]";
    }

    const key = String(keyNode);

    const isMerge = keyTag === MERGE_TAG || (keyTag === "?" && keyNode === "<<");

    if (isMerge) {
        keys ??= new Set<string>();

        if (Array.isArray(valueNode)) {
            for (const item of valueNode) {
                mergeMappings(state, result, item, keys);
            }
        } else {
            mergeMappings(state, result, valueNode, keys);
        }

        return keys;
    }

    if (!keys?.has(key) && hasOwn(result, key)) {
        if (state.options.duplicateKeys === "error") {
            throwError(state, `duplicated mapping key "${key}"`);
        } else if (state.options.duplicateKeys === "ignore") {
            return keys;
        }
    }

    if (key === "__proto__") {
        if (state.options.preventProtoPollution) {
            Object.defineProperty(result, key, { configurable: true, enumerable: true, value: valueNode, writable: true });
        }
    } else if ((key === "constructor" || key === "prototype") && state.options.preventProtoPollution) {
        // Silently drop the pollution-prone keys.
    } else {
        result[key] = valueNode;
    }

    keys?.delete(key);

    return keys;
};

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
        state.plainScalar = true;

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
    state.plainScalar = false;
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
    state.plainScalar = false;
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
    state.plainScalar = false;

    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;

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
            emptyLines++;
            continue;
        }

        // End of the scalar: a genuine dedent, or EOF for a zero-indented block
        // (where `lineIndent < textIndent` can never become true).
        if (state.lineIndent < textIndent || ch === 0) {
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

const readBlockSequence = (state: State, nodeIndent: number): boolean => {
    const savedTag = state.tag;
    const savedAnchor = state.anchor;
    const result: unknown[] = [];
    let detected = false;

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, result);
    }

    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        if (ch !== 0x2d) {
            break;
        }

        const following = state.input.charCodeAt(state.position + 1);

        if (!isWsOrEol(following)) {
            break;
        }

        detected = true;
        state.position++;

        if (skipSeparationSpace(state, true, -1) && state.lineIndent <= nodeIndent) {
            result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
        }

        const { line } = state;

        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        result.push(state.result);
        skipSeparationSpace(state, true, -1);

        ch = state.input.charCodeAt(state.position);

        if ((state.line === line || state.lineIndent > nodeIndent) && ch !== 0) {
            throwError(state, "bad indentation of a sequence entry");
        } else if (state.lineIndent < nodeIndent) {
            break;
        }
    }

    if (detected) {
        state.tag = savedTag;
        state.anchor = savedAnchor;
        state.kind = "sequence";
        state.result = result;

        return true;
    }

    return false;
};

const readBlockMapping = (state: State, nodeIndent: number, flowIndent: number): boolean => {
    const savedTag = state.tag;
    const savedAnchor = state.anchor;
    const result: Record<string, unknown> = {};
    let overridableKeys: Set<string> | undefined;

    let keyTag: string | null = null;
    let keyNode: unknown = null;
    let valueNode: unknown = null;
    let atExplicitKey = false;
    let detected = false;
    let allowCompact = false;

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, result);
    }

    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        const following = state.input.charCodeAt(state.position + 1);
        const { line } = state;

        if ((ch === 0x3f || ch === 0x3a) && isWsOrEol(following)) {
            if (ch === 0x3f) {
                if (atExplicitKey) {
                    overridableKeys = storeMappingPair(state, result, overridableKeys, keyTag, keyNode, null);
                    keyTag = null;
                    keyNode = null;
                    valueNode = null;
                }

                detected = true;
                atExplicitKey = true;
                allowCompact = true;
            } else if (atExplicitKey) {
                atExplicitKey = false;
                allowCompact = true;
            } else {
                // A `:` with no key node is an implicit entry with an empty
                // (null) key, e.g. `: value`.
                detected = true;
                atExplicitKey = false;
                allowCompact = false;
                keyTag = null;
                keyNode = null;
            }

            state.position += 1;
            ch = following;
        } else {
            if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
                break;
            }

            if (state.line === line) {
                ch = state.input.charCodeAt(state.position);

                while (isWhiteSpace(ch)) {
                    ch = state.input.charCodeAt(++state.position);
                }

                if (ch === 0x3a) {
                    ch = state.input.charCodeAt(++state.position);

                    if (!isWsOrEol(ch)) {
                        throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
                    }

                    if (atExplicitKey) {
                        overridableKeys = storeMappingPair(state, result, overridableKeys, keyTag, keyNode, null);
                        keyTag = null;
                        keyNode = null;
                        valueNode = null;
                    }

                    detected = true;
                    atExplicitKey = false;
                    allowCompact = false;
                    keyTag = state.tag;
                    keyNode = state.result;
                } else if (detected) {
                    throwError(state, "can not read an implicit mapping pair; a colon is missed");
                } else {
                    state.tag = savedTag;
                    state.anchor = savedAnchor;

                    return true;
                }
            } else if (detected) {
                throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
            } else {
                state.tag = savedTag;
                state.anchor = savedAnchor;

                return true;
            }
        }

        if (state.line === line || state.lineIndent > nodeIndent) {
            if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
                if (atExplicitKey) {
                    keyNode = state.result;
                } else {
                    valueNode = state.result;
                }
            }

            if (!atExplicitKey) {
                overridableKeys = storeMappingPair(state, result, overridableKeys, keyTag, keyNode, valueNode);
                keyTag = null;
                keyNode = null;
                valueNode = null;
            }

            skipSeparationSpace(state, true, -1);
            ch = state.input.charCodeAt(state.position);
        }

        if ((state.line === line || state.lineIndent > nodeIndent) && ch !== 0) {
            throwError(state, "bad indentation of a mapping entry");
        } else if (state.lineIndent < nodeIndent) {
            break;
        }
    }

    if (atExplicitKey) {
        overridableKeys = storeMappingPair(state, result, overridableKeys, keyTag, keyNode, null);
    }

    if (detected) {
        state.tag = savedTag;
        state.anchor = savedAnchor;
        state.kind = "mapping";
        state.result = result;
    }

    return detected;
};

const readFlowCollection = (state: State, nodeIndent: number): boolean => {
    const savedTag = state.tag;
    const savedAnchor = state.anchor;
    let overridableKeys: Set<string> | undefined;

    let ch = state.input.charCodeAt(state.position);
    let terminator: number;
    let isMapping: boolean;
    let result: unknown[] | Record<string, unknown>;

    if (ch === 0x5b) {
        terminator = 0x5d;
        isMapping = false;
        result = [];
    } else if (ch === 0x7b) {
        terminator = 0x7d;
        isMapping = true;
        result = {};
    } else {
        return false;
    }

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, result);
    }

    ch = state.input.charCodeAt(++state.position);

    let readNext = true;

    while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);

        if (ch === terminator) {
            state.position++;
            state.tag = savedTag;
            state.anchor = savedAnchor;
            state.kind = isMapping ? "mapping" : "sequence";
            state.result = result;

            return true;
        }

        if (!readNext) {
            throwError(state, "missed comma between flow collection entries");
        } else if (ch === 0x2c) {
            throwError(state, "expected the node content, but found ','");
        }

        let keyTag: string | null = null;
        let keyNode: unknown = null;
        let valueNode: unknown = null;
        let isPair = false;

        if (ch === 0x3f) {
            const following = state.input.charCodeAt(state.position + 1);

            if (isWsOrEol(following)) {
                isPair = true;
                state.position++;
                skipSeparationSpace(state, true, nodeIndent);
            }
        }

        const keyStartLine = state.line;

        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;

        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);

        // Inside a flow mapping (`{}`) the `:` may appear on a later line than
        // its key. An implicit-key pair inside a flow sequence (`[ key: v ]`)
        // requires a single-line implicit key with the colon on that same line.
        if (ch === 0x3a && (isMapping || isPair || keyStartLine === state.line)) {
            isPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
            composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
            valueNode = state.result;
        }

        if (isMapping) {
            overridableKeys = storeMappingPair(state, result as Record<string, unknown>, overridableKeys, keyTag, keyNode, valueNode);
        } else if (isPair) {
            const pair: Record<string, unknown> = {};

            overridableKeys = storeMappingPair(state, pair, overridableKeys, keyTag, keyNode, valueNode);
            (result as unknown[]).push(pair);
        } else {
            (result as unknown[]).push(keyNode);
        }

        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);

        if (ch === 0x2c) {
            readNext = true;
            ch = state.input.charCodeAt(++state.position);
        } else {
            readNext = false;
        }
    }

    return throwError(state, "unexpected end of the stream within a flow collection");
};

const PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z-]+!)$/i;

const readTagProperty = (state: State): boolean => {
    let ch = state.input.charCodeAt(state.position);

    if (ch !== 0x21) {
        return false;
    }

    if (state.tag !== null) {
        throwError(state, "duplication of a tag property");
    }

    let isVerbatim = false;
    let isNamed = false;
    let tagHandle = "!";

    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x3c) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
    } else if (ch === 0x21) {
        isNamed = true;
        tagHandle = "!!";
        ch = state.input.charCodeAt(++state.position);
    }

    let { position } = state;
    let tagName: string;

    if (isVerbatim) {
        do {
            ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 0x3e);

        if (state.position < state.length) {
            tagName = state.input.slice(position, state.position);
            state.position++;
        } else {
            return throwError(state, "unexpected end of the stream within a verbatim tag");
        }
    } else {
        while (ch !== 0 && !isWsOrEol(ch)) {
            if (ch === 0x21) {
                if (isNamed) {
                    throwError(state, "tag suffix cannot contain exclamation marks");
                } else {
                    tagHandle = state.input.slice(position - 1, state.position + 1);

                    if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                        throwError(state, "named tag handle cannot contain such characters");
                    }

                    isNamed = true;
                    position = state.position + 1;
                }
            }

            ch = state.input.charCodeAt(++state.position);
        }

        tagName = state.input.slice(position, state.position);
    }

    if (isVerbatim) {
        state.tag = tagName;
    } else if (state.tagMap.has(tagHandle)) {
        state.tag = state.tagMap.get(tagHandle)! + tagName;
    } else if (tagHandle === "!") {
        state.tag = `!${tagName}`;
    } else if (tagHandle === "!!") {
        state.tag = `tag:yaml.org,2002:${tagName}`;
    } else {
        throwError(state, `undeclared tag handle "${tagHandle}"`);
    }

    return true;
};

const readAnchorProperty = (state: State): boolean => {
    let ch = state.input.charCodeAt(state.position);

    if (ch !== 0x26) {
        return false;
    }

    if (state.anchor !== null) {
        throwError(state, "duplication of an anchor property");
    }

    ch = state.input.charCodeAt(++state.position);

    const { position } = state;

    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
    }

    if (state.position === position) {
        throwError(state, "name of an anchor node must contain at least one character");
    }

    state.anchor = state.input.slice(position, state.position);

    return true;
};

const readAlias = (state: State): boolean => {
    let ch = state.input.charCodeAt(state.position);

    if (ch !== 0x2a) {
        return false;
    }

    ch = state.input.charCodeAt(++state.position);

    const { position } = state;

    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
    }

    if (state.position === position) {
        throwError(state, "name of an alias node must contain at least one character");
    }

    const alias = state.input.slice(position, state.position);

    if (!state.anchorMap.has(alias)) {
        throwError(state, `unidentified alias "${alias}"`);
    }

    state.aliasCount++;

    if (state.aliasCount > state.options.maxAliasCount) {
        throwError(state, "alias reference count limit exceeded (possible resource-exhaustion attack)");
    }

    state.result = state.anchorMap.get(alias);
    state.kind = "scalar";

    return true;
};

const composeNode = (state: State, parentIndent: number, nodeContext: number, allowToSeek: boolean, allowCompact: boolean): boolean => {
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;

    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;

    const allowBlockStyles = nodeContext === CONTEXT_BLOCK_OUT || nodeContext === CONTEXT_BLOCK_IN;
    const allowBlockScalars = allowBlockStyles;
    let allowBlockCollections = allowBlockStyles;

    if (allowToSeek && skipSeparationSpace(state, true, -1)) {
        atNewLine = true;

        if (state.lineIndent > parentIndent) {
            indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
        } else {
            indentStatus = -1;
        }
    }

    if (indentStatus === 1) {
        while (readTagProperty(state) || readAnchorProperty(state)) {
            if (skipSeparationSpace(state, true, -1)) {
                atNewLine = true;
                allowBlockCollections = allowBlockStyles;

                if (state.lineIndent > parentIndent) {
                    indentStatus = 1;
                } else if (state.lineIndent === parentIndent) {
                    indentStatus = 0;
                } else {
                    indentStatus = -1;
                }
            } else {
                allowBlockCollections = false;
            }
        }
    }

    if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
    }

    if (indentStatus === 1 || nodeContext === CONTEXT_BLOCK_OUT) {
        const flowIndent = nodeContext === CONTEXT_FLOW_IN || nodeContext === CONTEXT_FLOW_OUT ? parentIndent : parentIndent + 1;
        const blockIndent = state.position - state.lineStart;

        if (indentStatus === 1) {
            let matchedCollection = allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent));

            if (!matchedCollection) {
                matchedCollection = readFlowCollection(state, flowIndent);
            }

            if (matchedCollection) {
                hasContent = true;
            } else {
                let matchedScalar = allowBlockScalars && readBlockScalar(state, flowIndent);

                if (!matchedScalar) {
                    matchedScalar = readSingleQuotedScalar(state, flowIndent);
                }

                if (!matchedScalar) {
                    matchedScalar = readDoubleQuotedScalar(state, flowIndent);
                }

                if (matchedScalar) {
                    hasContent = true;
                } else if (readAlias(state)) {
                    hasContent = true;

                    if (state.tag !== null || state.anchor !== null) {
                        throwError(state, "alias node should not have any properties");
                    }
                } else if (readPlainScalar(state, flowIndent, nodeContext === CONTEXT_FLOW_IN)) {
                    hasContent = true;

                    state.tag ??= "?";
                }

                if (state.anchor !== null) {
                    state.anchorMap.set(state.anchor, state.result);
                }
            }
        } else if (indentStatus === 0) {
            hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
    }

    if (state.tag === null) {
        if (state.anchor !== null) {
            state.anchorMap.set(state.anchor, state.result);
        }
    } else if (state.tag === "?") {
        if (state.kind === "scalar" && typeof state.result === "string") {
            state.result = resolveScalarValue(state.result);
        }

        if (state.anchor !== null) {
            state.anchorMap.set(state.anchor, state.result);
        }
    } else if (state.tag !== "!") {
        if (state.kind === "scalar") {
            const applied = resolveExplicitTag(state.tag, state.result as string);

            if (applied) {
                state.result = applied.value;
            }
        }

        if (state.anchor !== null) {
            state.anchorMap.set(state.anchor, state.result);
        }
    } else if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, state.result);
    }

    return state.tag !== null || state.anchor !== null || hasContent;
};

const readDocument = (state: State): void => {
    let hasDirectives = false;

    state.tagMap = new Map<string, string>();
    state.anchorMap = new Map<string, unknown>();
    state.aliasCount = 0;

    let ch: number;

    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);

        if (state.lineIndent > 0 || ch !== 0x25) {
            break;
        }

        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);

        let { position } = state;

        while (ch !== 0 && !isWsOrEol(ch)) {
            ch = state.input.charCodeAt(++state.position);
        }

        const directiveName = state.input.slice(position, state.position);
        const directiveArgs: string[] = [];

        if (directiveName.length === 0) {
            throwError(state, "directive name must not be less than one character in length");
        }

        while (ch !== 0) {
            while (isWhiteSpace(ch)) {
                ch = state.input.charCodeAt(++state.position);
            }

            if (ch === 0x23) {
                do {
                    ch = state.input.charCodeAt(++state.position);
                } while (ch !== 0 && !isEol(ch));

                break;
            }

            if (isEol(ch)) {
                break;
            }

            position = state.position;

            while (ch !== 0 && !isWsOrEol(ch)) {
                ch = state.input.charCodeAt(++state.position);
            }

            directiveArgs.push(state.input.slice(position, state.position));
        }

        if (ch !== 0) {
            readLineBreak(state);
        }

        if (directiveName === "YAML") {
            if (directiveArgs.length !== 1) {
                emitWarning(state, "the YAML directive accepts exactly one argument");
            } else if (!YAML_VERSION_RE.test(directiveArgs[0] ?? "")) {
                emitWarning(state, "ill-formed argument of the YAML directive");
            }
        } else if (directiveName === "TAG") {
            if (directiveArgs.length === 2) {
                state.tagMap.set(directiveArgs[0]!, directiveArgs[1]!);
            } else {
                emitWarning(state, "the TAG directive accepts exactly two arguments");
            }
        } else {
            emitWarning(state, `unknown document directive "${directiveName}"`);
        }
    }

    skipSeparationSpace(state, true, -1);

    // A document-start marker is `---` only when followed by white space or EOF;
    // `---foo` is a plain scalar, not a marker.
    let explicitMarker = false;

    if (state.lineIndent === 0 && state.input.startsWith("---", state.position) && isWsOrEol(state.input.charCodeAt(state.position + 3))) {
        state.position += 3;
        explicitMarker = true;
        skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
        throwError(state, "directives end mark is expected");
    }

    const hadContent = composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);

    skipSeparationSpace(state, true, -1);

    // A comment/whitespace/`...`-only section is not a document; only emit one
    // when it has content, an explicit `---` marker, or directives.
    if (hadContent || explicitMarker || hasDirectives) {
        state.documents.push(state.result);
    }

    if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 0x2e) {
            state.position += 3;
            skipSeparationSpace(state, true, -1);
        }

        return;
    }

    if (state.position < state.length - 1) {
        throwError(state, "end of the stream or a document separator is expected");
    }
};

const normalizeInput = (input: string): string => {
    let source = input;

    if (source.length > 0) {
        const last = source.charCodeAt(source.length - 1);

        if (last !== 0x0a && last !== 0x0d) {
            source += "\n";
        }

        if (source.charCodeAt(0) === 0xfe_ff) {
            source = source.slice(1);
        }
    }

    return source;
};

/** Parse every document in a YAML stream, returning them in order. */
export const loadAll = (input: string, options: ParseOptions = {}): unknown[] => {
    let source = normalizeInput(input);

    if (source.includes("\0")) {
        throw new YAMLParseError("null byte is not allowed in input");
    }

    source += "\0";

    const state = new State(source, options);

    state.position = 0;
    state.lineIndent = 0;

    while (state.position < state.length - 1) {
        readDocument(state);
    }

    return state.documents;
};

/** Parse the first document in a YAML stream. */
export const loadOne = (input: string, options: ParseOptions = {}): unknown => {
    const documents = loadAll(input, options);

    if (documents.length === 0) {
        return undefined;
    }

    if (documents.length === 1) {
        return documents[0];
    }

    throw new YAMLParseError("expected a single document in the stream, but found more");
};
