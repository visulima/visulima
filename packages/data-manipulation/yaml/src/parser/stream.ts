/*
 * Part of the hand-written parser; the file-scope disables mirror `loader.ts`.
 */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-dynamic-delete */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * The document and stream layer: directives, the `---`/`...` markers, and the
 * three entry points.
 *
 * This drives the composer and the composer never calls back into it, so the
 * import runs one way.
 */

import type { YAMLWarning } from "../errors";
import { YAMLParseError } from "../errors";
import type { LoaderOptions, ParseOptions } from "../types";
import { isPlainObject } from "./collections";
import { composeNode, CONTEXT_BLOCK_OUT } from "./loader";
import type { MappingRanges } from "./ranges";
import { isEol, isWhiteSpace, isWsOrEol, readLineBreak, skipSeparationSpace, testDocumentSeparator } from "./scanner";
import { emitWarning, State, throwError } from "./state";

const YAML_VERSION_RE = /^\d+\.\d+$/;

const readDocument = (state: State): void => {
    let hasDirectives = false;
    let hasYamlDirective = false;

    state.tagMap = new Map<string, string>();
    state.anchorMap = new Map<string, unknown>();
    state.aliasCount = 0;
    // Directives bind to the document that declares them, so a `%YAML` in an
    // earlier document of the stream must not leak into this one.
    state.resetVersionDirective();

    let ch: number;

    while (state.input.charCodeAt(state.position) !== 0) {
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
            // A malformed %YAML directive is a hard error in both refs (js-yaml
            // and yaml): wrong argument count, an argument that is not `<n>.<n>`,
            // or a second %YAML directive in the same document.
            if (hasYamlDirective) {
                throwError(state, "duplication of a YAML directive");
            } else if (directiveArgs.length !== 1) {
                throwError(state, "the YAML directive accepts exactly one argument");
            } else if (!YAML_VERSION_RE.test(directiveArgs[0] ?? "")) {
                throwError(state, "ill-formed argument of the YAML directive");
            }

            hasYamlDirective = true;
            state.applyVersionDirective(directiveArgs[0]!);
        } else if (directiveName === "TAG") {
            if (directiveArgs.length === 2) {
                state.tagMap.set(directiveArgs[0]!, directiveArgs[1]!);
            } else {
                throwError(state, "the TAG directive accepts exactly two arguments");
            }
        } else {
            // Unknown directives are ignored (with a warning) by both refs for
            // forward-compatibility — do not reject them.
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

        // In strict mode a *block* collection may not begin on the `---` line
        // (`--- a: b`), while a flow collection or scalar is fine (`--- {a: b}`,
        // `--- a`). Record the marker's line so readBlockMapping/readBlockSequence
        // can reject a first key/entry that sits on it; content (or just a
        // property like `--- !tag`) followed by a line break is unaffected.
        if (skipSeparationSpace(state, true, -1) === 0) {
            state.documentMarkerLine = state.line;
        }
    } else if (hasDirectives) {
        throwError(state, "directives end mark is expected");
    }

    const hadContent = composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);

    state.documentMarkerLine = -1;

    skipSeparationSpace(state, true, -1);

    // A comment/whitespace/`...`-only section is not a document; only emit one
    // when it has content, an explicit `---` marker, or directives.
    if (hadContent || explicitMarker || hasDirectives) {
        state.documents.push(state.result);
    }

    if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 0x2e) {
            state.position += 3;

            // After a `...` document-end marker only white space and an optional
            // comment may follow on the same line; `... invalid` is malformed.
            let after = state.input.charCodeAt(state.position);

            while (after === 0x20 || after === 0x09) {
                after = state.input.charCodeAt(++state.position);
            }

            if (after !== 0 && after !== 0x23 && !isEol(after)) {
                throwError(state, "unexpected content after document end marker");
            }

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

/**
 * Validate the input and build a cursor over it. Shared by every entry point so
 * the trust-boundary checks cannot be bypassed by one of them.
 */
const prepareState = (input: string, options: LoaderOptions): State => {
    // A non-string must fail as a YAMLParseError rather than as whichever
    // TypeError the first string method happens to raise — callers catch the
    // former.
    if (typeof input !== "string") {
        throw new YAMLParseError(`expected a string to parse, received ${input === null ? "null" : typeof input}`);
    }

    let source = normalizeInput(input);

    if (source.includes("\0")) {
        throw new YAMLParseError("null byte is not allowed in input");
    }

    source += "\0";

    const state = new State(source, options);

    state.position = 0;
    state.lineIndent = 0;

    return state;
};

/**
 * Walk a parsed value depth-first, letting `reviver` rewrite or drop entries —
 * the `JSON.parse` contract, extended to `Map` so it also works under
 * `mapAsMap`. Returning `undefined` removes the entry.
 */
const applyReviver = (holder: unknown, key: unknown, value: unknown, reviver: (key: unknown, value: unknown) => unknown): unknown => {
    if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) {
            const revived = applyReviver(value, String(index), value[index], reviver);

            // Assign rather than splice. Removing the element shifts every
            // later index, so a reviver that drops one entry silently
            // renumbered the rest.
            value[index] = revived;
        }
    } else if (value instanceof Map) {
        for (const entryKey of value.keys()) {
            const revived = applyReviver(value, entryKey, value.get(entryKey), reviver);

            if (revived === undefined) {
                value.delete(entryKey);
            } else {
                value.set(entryKey, revived);
            }
        }
    } else if (isPlainObject(value)) {
        const record = value as Record<string, unknown>;

        for (const entryKey of Object.keys(record)) {
            const revived = applyReviver(record, entryKey, record[entryKey], reviver);

            if (revived === undefined) {
                delete record[entryKey];
            } else {
                record[entryKey] = revived;
            }
        }
    }

    return reviver.call(holder, key, value);
};

/** Parse every document in a YAML stream, returning them in order. */
const loadAll = (input: string, options: ParseOptions = {}): unknown[] => {
    const state = prepareState(input, options);

    while (state.position < state.length - 1) {
        readDocument(state);
    }

    const { reviver } = options;

    if (reviver) {
        return state.documents.map((document) => applyReviver({ "": document }, "", document, reviver));
    }

    return state.documents;
};

/**
 * Move the cursor to the next document marker after a failed document, so one
 * malformed document does not hide the rest of the stream. Returns false when
 * there is nothing left to parse.
 */
const skipToNextDocument = (state: State): boolean => {
    const { input } = state;
    let index = input.indexOf("\n", state.position);

    while (index !== -1) {
        const lineStart = index + 1;
        const marker = input.slice(lineStart, lineStart + 3);

        if (marker === "---" || marker === "...") {
            state.position = lineStart;
            state.lineStart = lineStart;
            state.line += 1;
            state.lineIndent = 0;
            state.firstTabInLine = -1;

            return state.position < state.length - 1;
        }

        index = input.indexOf("\n", lineStart);
    }

    return false;
};

/** One document of a stream, with the diagnostics raised while reading it. */
interface DocumentResult {
    contents: unknown;
    errors: YAMLParseError[];
    warnings: YAMLWarning[];
}

/**
 * Parse a stream without throwing: each document's diagnostics are collected
 * and a malformed document does not prevent the following ones from parsing.
 *
 * Recovery is per document — within one document the first error still ends it,
 * because the parser has no resync points inside a document.
 */
const loadDocuments = (input: string, options: LoaderOptions = {}): { documents: DocumentResult[]; ranges: MappingRanges } => {
    const warnings: YAMLWarning[] = [];
    const state = prepareState(input, {
        ...options,
        onWarning: (warning) => {
            warnings.push(warning);
            options.onWarning?.(warning);
        },
    });

    state.mappingRanges = new WeakMap();

    const documents: DocumentResult[] = [];

    while (state.position < state.length - 1) {
        const producedBefore = state.documents.length;
        const warningsBefore = warnings.length;
        const positionBefore = state.position;

        try {
            readDocument(state);
        } catch (error) {
            if (!(error instanceof YAMLParseError)) {
                throw error;
            }

            documents.push({ contents: null, errors: [error], warnings: warnings.slice(warningsBefore) });

            if (!skipToNextDocument(state)) {
                break;
            }

            continue;
        }

        for (const contents of state.documents.slice(producedBefore)) {
            documents.push({ contents, errors: [], warnings: warnings.slice(warningsBefore) });
        }

        // A document that consumed nothing would loop forever.
        if (state.position === positionBefore) {
            break;
        }
    }

    return { documents, ranges: state.mappingRanges };
};

/** Parse the first document in a YAML stream. */
const loadOne = (input: string, options: ParseOptions = {}): unknown => {
    const documents = loadAll(input, options);

    if (documents.length === 0) {
        return undefined;
    }

    if (documents.length === 1) {
        return documents[0];
    }

    throw new YAMLParseError("expected a single document in the stream, but found more");
};

export type { DocumentResult };
export { applyReviver, loadAll, loadDocuments, loadOne };
