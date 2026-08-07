/*
 * This is a hand-written, performance-sensitive scanner. Several lint rules are
 * disabled at file scope because they conflict with the parser's design: a
 * single mutable `State` cursor is threaded through every function (parameter
 * reassignment), `charCodeAt` is used deliberately for byte-level scanning with
 * a `0` EOF sentinel, and YAML's `null` is a first-class value in the output.
 */

/* eslint-disable no-plusplus */

/* eslint-disable no-useless-assignment */

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

import type { YAMLWarning } from "../errors";
import { YAMLParseError } from "../errors";
import { resolveExplicitTag } from "../schema/resolve-scalar";
import { INVALID_SCALAR } from "../schema/schemas";
import { resolveImplicitTag } from "../schema/tags";
import type { ParseOptions } from "../types";
import type { MappingRanges } from "./ranges";
import { readBlockScalar, readDoubleQuotedScalar, readPlainScalar, readSingleQuotedScalar } from "./scalars";
import { isEol, isFlowIndicator, isWhiteSpace, isWsOrEol, readLineBreak, skipSeparationSpace, testDocumentSeparator } from "./scanner";
import type { Snapshot } from "./state";
import { beginSpeculation, emitWarning, restoreState, rollbackSpeculation, snapshotState, State, throwError } from "./state";

const isPlainObject = (value: unknown): boolean => typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]";

const CONTEXT_FLOW_IN = 1;
const CONTEXT_FLOW_OUT = 2;
const CONTEXT_BLOCK_IN = 3;
const CONTEXT_BLOCK_OUT = 4;

const MERGE_TAG = "tag:yaml.org,2002:merge";

const YAML_VERSION_RE = /^\d+\.\d+$/;

/**
 * Write one mapping key, never letting the document reach the prototype chain.
 *
 * `target[key] = value` is unsafe for `__proto__`: that name resolves to an
 * inherited accessor, so the assignment swaps the object's prototype instead of
 * creating a key. With the guard on we define it as an own data property, which
 * both keeps the document's data and leaves the prototype untouched. With the
 * guard off the caller has explicitly opted into the raw assignment.
 *
 * `constructor` / `prototype` are written normally: `target` is always a fresh
 * object literal, so an own property of either name merely shadows a harmless
 * inherited one — dropping them (as this used to) lost data for no gain.
 *
 * Every write goes through here, including merge keys (`&lt;&lt;`) — routing those
 * around it is what previously let `&lt;&lt;` bypass the guard entirely.
 */
const assignMappingKey = (state: State, target: MappingTarget, key: unknown, value: unknown): void => {
    // A Map keeps keys as their own values, so the prototype chain is never in
    // play and no guard is needed.
    if (target instanceof Map) {
        target.set(key, value);

        return;
    }

    if (key === "__proto__" && state.options.preventProtoPollution) {
        Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });

        return;
    }

    target[key as string] = value;
};

/** Whether `target` already carries `key`. */
const mappingHas = (target: MappingTarget, key: unknown): boolean => {
    if (target instanceof Map) {
        return target.has(key);
    }

    return Object.hasOwn(target, key as string);
};

/** Every key currently in `target`. */
const mappingKeys = (target: MappingTarget): unknown[] => {
    if (target instanceof Map) {
        return [...target.keys()];
    }

    return Object.keys(target);
};

/** Read one key back out of `target`. */
const mappingGet = (target: MappingTarget, key: unknown): unknown => {
    if (target instanceof Map) {
        return target.get(key);
    }

    return target[String(key)];
};

const mergeMappings = (state: State, destination: MappingTarget, source: unknown, overridableKeys: Set<unknown>): void => {
    if (!isPlainObject(source) && !(source instanceof Map)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }

    const from = source as MappingTarget;

    for (const key of mappingKeys(from)) {
        if (!mappingHas(destination, key)) {
            assignMappingKey(state, destination, key, mappingGet(from, key));
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
// A plain object can only carry string keys, so a complex (collection) key is
// flattened to a stable string. The brackets/braces matter: without them every
// mapping key collapsed to the same `[object Object]` and `? [a, b]` collided
// with the plain string key `a,b`, silently merging distinct entries.
const stringifyComplexKey = (node: unknown): string => {
    if (Array.isArray(node)) {
        return `[${(node as unknown[]).map((part) => stringifyComplexKey(part)).join(",")}]`;
    }

    if (isPlainObject(node)) {
        const entries = Object.entries(node as Record<string, unknown>)
            .map(([key, item]) => `${key}: ${stringifyComplexKey(item)}`)
            .toSorted((a, b) => a.localeCompare(b));

        return `{${entries.join(", ")}}`;
    }

    return String(node);
};

/** A parsed mapping: a plain object, or a Map when `mapAsMap` is set. */
type MappingTarget = Map<unknown, unknown> | Record<string, unknown>;

/** Build the container a mapping accumulates into. */
const createMapping = (state: State): MappingTarget => {
    if (state.options.mapAsMap) {
        return new Map<unknown, unknown>();
    }

    return {};
};

/** The string a mapping key is stored under. */
const mappingKeyOf = (keyNode: unknown): string => {
    if (typeof keyNode === "object" && keyNode !== null) {
        return stringifyComplexKey(keyNode);
    }

    return String(keyNode);
};

/**
 * Record where one block-mapping entry sits in the source. No-op unless
 * `parseDocument` asked for ranges.
 */
const recordMappingEntry = (state: State, mapping: object, keyNode: unknown, start: number, valueStart: number, end: number): void => {
    if (state.mappingRanges === null || start < 0) {
        return;
    }

    let entries = state.mappingRanges.get(mapping);

    if (entries === undefined) {
        entries = [];
        state.mappingRanges.set(mapping, entries);
    }

    entries.push({ column: start - (state.input.lastIndexOf("\n", start - 1) + 1), end, key: mappingKeyOf(keyNode), start, valueStart });
};

const storeMappingPair = (
    state: State,
    result: MappingTarget,
    overridableKeys: Set<unknown> | undefined,
    keyTag: string | null,
    keyNodeInput: unknown,
    valueNode: unknown,
): Set<unknown> | undefined => {
    const keyNode = keyNodeInput;
    let keys = overridableKeys;

    // A Map can hold a collection as a key; a plain object cannot, so there the
    // key is flattened to a stable string. `stringKeys` forces the flattened
    // form even for a Map.
    // A Map can hold a collection as a key; a plain object cannot.
    let key: unknown = keyNode;

    if (!(result instanceof Map) || state.options.stringKeys) {
        key = mappingKeyOf(keyNode);
    }

    const isMerge = state.options.merge !== false && (keyTag === MERGE_TAG || (keyTag === "?" && keyNode === "<<"));

    if (isMerge) {
        keys ??= new Set<unknown>();

        if (Array.isArray(valueNode)) {
            for (const item of valueNode) {
                mergeMappings(state, result, item, keys);
            }
        } else {
            mergeMappings(state, result, valueNode, keys);
        }

        return keys;
    }

    if (!keys?.has(key) && mappingHas(result, key)) {
        if (state.options.duplicateKeys === "error") {
            throwError(state, `duplicated mapping key "${String(key)}"`);
        } else if (state.options.duplicateKeys === "ignore") {
            return keys;
        }
    }

    assignMappingKey(state, result, key, valueNode);

    keys?.delete(key);

    return keys;
};

const readBlockSequence = (state: State, nodeIndent: number): boolean => {
    const savedTag = state.tag;
    const savedAnchor = state.anchor;
    const result: unknown[] = [];
    let detected = false;

    // A tab in this line's indentation cannot introduce a block sequence.
    if (state.firstTabInLine !== -1) {
        return false;
    }

    // Strict mode: a block sequence may not begin on the `---` marker line
    // (checked once an entry is actually detected, since this reader is also
    // invoked speculatively for scalars).
    const entryLine = state.line;

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, result);
    }

    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        // Tabs are not valid indentation before a sequence entry (`-\t-`).
        if (state.firstTabInLine !== -1) {
            state.position = state.firstTabInLine;

            throwError(state, "tab characters must not be used in indentation");
        }

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
        if (state.options.strict && entryLine === state.documentMarkerLine) {
            throwError(state, "a block collection cannot start on the same line as the document start marker");
        }

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
    const result = createMapping(state);
    let overridableKeys: Set<unknown> | undefined;

    let keyTag: string | null = null;
    let keyNode: unknown = null;
    let valueNode: unknown = null;
    let atExplicitKey = false;
    let detected = false;
    let allowCompact = false;
    let entryKeyStart = -1;
    let entryValueStart = -1;

    // A tab in this line's indentation cannot introduce a block mapping.
    if (state.firstTabInLine !== -1) {
        return false;
    }

    // Strict mode: a block mapping may not begin on the `---` marker line
    // (checked once a key is actually detected — this reader also runs
    // speculatively for scalars and block scalars).
    const entryLine = state.line;

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, result);
    }

    let ch = state.input.charCodeAt(state.position);

    while (ch !== 0) {
        // Tabs are not valid indentation before a mapping key (`foo:\n \tb: 2`).
        // An explicit-key value (`? k\n:\tv`) may legally be tab-separated.
        if (!atExplicitKey && state.firstTabInLine !== -1) {
            state.position = state.firstTabInLine;

            throwError(state, "tab characters must not be used in indentation");
        }

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
            entryKeyStart = state.position;

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
                    entryValueStart = state.position + 1;
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
                recordMappingEntry(state, result, keyNode, entryKeyStart, entryValueStart, state.position);
                overridableKeys = storeMappingPair(state, result, overridableKeys, keyTag, keyNode, valueNode);
                keyTag = null;
                keyNode = null;
                valueNode = null;
                entryKeyStart = -1;
                entryValueStart = -1;
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
        storeMappingPair(state, result, overridableKeys, keyTag, keyNode, null);
    }

    if (detected) {
        if (state.options.strict && entryLine === state.documentMarkerLine) {
            throwError(state, "a block collection cannot start on the same line as the document start marker");
        }

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
    let overridableKeys: Set<unknown> | undefined;

    let ch = state.input.charCodeAt(state.position);
    let terminator: number;
    let isMapping: boolean;
    let result: MappingTarget | unknown[];

    if (ch === 0x5b) {
        terminator = 0x5d;
        isMapping = false;
        result = [];
    } else if (ch === 0x7b) {
        terminator = 0x7d;
        isMapping = true;
        result = createMapping(state);
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

        // The loop stops on `>` or on the `\0` sentinel. Only the former is a
        // terminated tag: testing `position < length` instead would also accept
        // the sentinel, then advance the cursor to `length`, where `charCodeAt`
        // yields NaN — which every `ch !== 0` scan treats as content, spinning
        // forever instead of failing.
        if (ch === 0x3e) {
            tagName = state.input.slice(position, state.position);
            state.position++;
        } else {
            return throwError(state, "unexpected end of the stream within a verbatim tag");
        }
    } else {
        // Per the YAML grammar `ns-tag-char` excludes the flow indicators
        // `,[]{}`, so a shorthand tag ends at the first one (e.g. `!!str,` in a
        // flow collection tags empty content and the comma starts the next
        // entry). js-yaml instead reads greedily and then rejects — which makes
        // it fail suite case WZ62; stopping here is the spec-correct behaviour.
        while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
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

/**
 * Speculatively read a block mapping, starting at `from` if given.
 *
 * Two shapes need this. `&amp;anchor key: value` / `!!tag key: value` put node
 * properties on the *first key* of a mapping rather than on the node being
 * composed, so the cursor rewinds to before the properties (`from`) and re-reads
 * them as that key. `!!map\n&amp;a !!str key: value` instead starts the mapping at
 * the current position (`from` omitted).
 *
 * On failure everything the attempt touched — cursor, anchors, alias budget — is
 * rolled back, so the caller can try a different shape.
 */
const speculateBlockMapping = (state: State, nodeIndent: number, flowIndent: number, from?: Snapshot): boolean => {
    const undo = beginSpeculation(state);

    if (from) {
        restoreState(state, from);
    }

    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;

    let formed = false;

    try {
        formed = readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping";
    } catch (error) {
        // A parse error here only means "no block mapping at this position" —
        // that is the question being asked, so rewind and let the caller try
        // another shape. Anything else (a TypeError from a parser bug, a
        // RangeError from stack exhaustion) is a genuine fault and must not be
        // disguised as a failed guess.
        if (!(error instanceof YAMLParseError)) {
            throw error;
        }

        formed = false;
    }

    if (formed) {
        return true;
    }

    rollbackSpeculation(state, undo);

    return false;
};

const composeNodeAtDepth = (state: State, parentIndent: number, nodeContext: number, allowToSeek: boolean, allowCompact: boolean): boolean => {
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let nestedMappingMatched = false;
    let repeatedPropertyOnNewLine = false;
    let propertyStart: Snapshot | null = null;

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
        for (;;) {
            const ch = state.input.charCodeAt(state.position);

            // After a line break, a repeated property token starts the first key
            // of a nested block mapping (e.g. `!!map\n  !!str key: value`) — OR it
            // is a second anchor/tag on this same node, which is illegal. Which
            // one is only known after trying to read a mapping below; flag it so
            // strict mode can reject the "two anchors on one node" case (4JVG).
            if (atNewLine && ((ch === 0x21 && state.tag !== null) || (ch === 0x26 && state.anchor !== null))) {
                repeatedPropertyOnNewLine = true;

                break;
            }

            // A new-line property of a *different* kind than what we already hold
            // may still begin a block-mapping key whose value is the current node
            // (`!!map\n&a8 !!str key: value`). Try that mapping transactionally;
            // if it forms, it becomes the content (outer tag/anchor still apply)
            // and we stop. If not, fall through and read the property normally so
            // a multi-line scalar with several properties (`&a\n!!str\nx`) works.
            if (atNewLine && (ch === 0x21 || ch === 0x26) && (state.tag !== null || state.anchor !== null)) {
                const outerTag: string | null = state.tag;
                const outerAnchor: string | null = state.anchor;

                if (speculateBlockMapping(state, state.position - state.lineStart, parentIndent + 1)) {
                    // The mapping is this node's content; the properties we had
                    // already collected still belong to the node itself.
                    state.tag = outerTag;
                    state.anchor = outerAnchor;

                    if (state.anchor !== null) {
                        state.anchorMap.set(state.anchor, state.result);
                    }

                    nestedMappingMatched = true;

                    break;
                }

                state.tag = outerTag;
                state.anchor = outerAnchor;
            }

            // Strict mode: a node property carried onto a new line must be
            // indented deeper than the parent node. `key: &a\n!!map\n  a: b`
            // puts `!!map` at the key's own column, which the spec forbids even
            // though both refs accept it.
            if (state.options.strict && atNewLine && indentStatus !== 1 && (ch === 0x21 || ch === 0x26)) {
                throwError(state, "a node property must be indented more than its parent node");
            }

            const propertyState = snapshotState(state);

            if (!readTagProperty(state) && !readAnchorProperty(state)) {
                break;
            }

            propertyStart ??= propertyState;

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

    if (nestedMappingMatched) {
        // The content was already read as a block mapping in the property loop
        // (its outer tag/anchor re-applied there); skip the normal content scan.
        hasContent = true;
    } else if (indentStatus === 1 || nodeContext === CONTEXT_BLOCK_OUT) {
        const flowIndent = nodeContext === CONTEXT_FLOW_IN || nodeContext === CONTEXT_FLOW_OUT ? parentIndent : parentIndent + 1;
        const blockIndent = state.position - state.lineStart;

        if (indentStatus === 1) {
            let matchedCollection = allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent));

            if (!matchedCollection) {
                matchedCollection = readFlowCollection(state, flowIndent);
            }

            const nextCh = state.input.charCodeAt(state.position);
            const canRewindProperty = propertyStart !== null && allowBlockStyles && !allowBlockCollections && nextCh !== 0x7c && nextCh !== 0x3e;

            let matchedProperty = false;

            if (!matchedCollection && canRewindProperty && propertyStart) {
                const keyIndent = propertyStart.position - propertyStart.lineStart;

                matchedProperty = speculateBlockMapping(state, keyIndent, flowIndent, propertyStart);
            }

            // Strict mode: a repeated anchor/tag carried onto a new line is valid
            // only when it turned out to be the first property of a nested block
            // mapping/sequence key. If the node instead resolved to a scalar, the
            // repeated property is a second anchor/tag on that one scalar — e.g.
            // `top: &a\n  &b val` gives the scalar two anchors (suite case 4JVG).
            if (state.options.strict && repeatedPropertyOnNewLine && state.kind !== "mapping" && state.kind !== "sequence") {
                throwError(state, "a node may only have one anchor and one tag");
            }

            if (matchedCollection || matchedProperty) {
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
            }
        } else if (indentStatus === 0) {
            hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
    }

    // Resolve the tag first, then register the anchor exactly once. The ordering
    // is load-bearing: an anchor must name the *resolved* value, so the store has
    // to come last. (Collections register themselves earlier, before their
    // children are parsed, so that a self-reference like `&a [ *a ]` resolves.)
    if (state.tag === "?") {
        if (state.kind === "scalar" && typeof state.result === "string") {
            const implicit = resolveImplicitTag(state.tags, state.result);

            if (implicit) {
                state.result = implicit.value;

                if (state.anchor !== null) {
                    state.anchorMap.set(state.anchor, state.result);
                }

                return state.tag !== null || state.anchor !== null || hasContent;
            }

            const resolved = state.resolveScalar(state.result);

            // Only the `json` schema rejects: any scalar outside the JSON
            // grammar is a document error there.
            if (resolved === INVALID_SCALAR) {
                throwError(state, `unquoted scalar "${state.result}" is not valid under the json schema`);
            }

            state.result = resolved;
        }
    } else if (
        // A scalar node, or an explicit tag on empty content (`!!str` with
        // nothing after it, common in flow: `{ a: !!str, ... }`). In the empty
        // case the node has no kind yet — treat the content as the empty string
        // so `!!str` → "" and `!!null` → null, matching the core schema.
        state.tag !== null
        && state.tag !== "!"
        && (state.kind === "scalar" || (!hasContent && state.kind === null))
    ) {
        const raw = typeof state.result === "string" ? state.result : "";
        // A custom tag takes precedence over the core table for the same name,
        // so a caller can redefine `!!int` if they mean to.
        const custom = state.tags?.byTag.get(state.tag);

        if (custom) {
            state.result = custom.resolve(raw);
        } else {
            const applied = resolveExplicitTag(state.tag, raw);

            if (applied.status === "ok") {
                state.result = applied.value;
            } else if (applied.status === "invalid") {
                throwError(state, `unacceptable value "${raw}" for the "${state.tag}" tag`);
            }
        }
    }

    if (state.anchor !== null) {
        state.anchorMap.set(state.anchor, state.result);
    }

    return state.tag !== null || state.anchor !== null || hasContent;
};

/**
 * Compose one node, bounding recursion depth.
 *
 * Without this a document like `[[[[…` recurses until the JS stack is exhausted
 * and escapes as a `RangeError`, which is outside the `YAMLError` hierarchy
 * callers catch. `finally` (rather than a decrement before the single return)
 * keeps the counter honest when a speculative parse unwinds through here.
 */
const composeNode = (state: State, parentIndent: number, nodeContext: number, allowToSeek: boolean, allowCompact: boolean): boolean => {
    if (state.depth >= state.options.maxDepth) {
        throwError(state, `maximum nesting depth of ${String(state.options.maxDepth)} exceeded`);
    }

    state.depth += 1;

    try {
        return composeNodeAtDepth(state, parentIndent, nodeContext, allowToSeek, allowCompact);
    } finally {
        state.depth -= 1;
    }
};

const readDocument = (state: State): void => {
    let hasDirectives = false;
    let hasYamlDirective = false;

    state.tagMap = new Map<string, string>();
    state.anchorMap = new Map<string, unknown>();
    state.aliasCount = 0;

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
const prepareState = (input: string, options: ParseOptions): State => {
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

            if (revived === undefined) {
                value.splice(index, 1);
            } else {
                value[index] = revived;
            }
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
const loadDocuments = (input: string, options: ParseOptions = {}): { documents: DocumentResult[]; ranges: MappingRanges } => {
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
export { loadAll, loadDocuments, loadOne };
