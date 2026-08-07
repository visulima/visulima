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

/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * The composer: source text in, a composed node out.
 *
 * A single mutable cursor walks the string and indentation columns are threaded
 * through the block readers. What shape the result takes — plain objects, `Map`s
 * or a node tree — is not decided here; `state.build` was chosen once from the
 * options (see `collection-builder.ts`).
 *
 * The readers below are mutually recursive, which is why they share a file. The
 * pieces that are not — node properties, and the document/stream layer — live in
 * `properties.ts` and `stream.ts`.
 */

import { YAMLParseError } from "../errors";
import { resolveExplicitTag } from "../schema/resolve-scalar";
import { INVALID_SCALAR } from "../schema/schemas";
import { resolveImplicitTag } from "../schema/tags";
import type { MappingTarget, SeqTarget } from "./collection-builder";
import { recordMappingEntry, storeMappingPair } from "./collections";
import { readAlias, readAnchorProperty, readTagProperty } from "./properties";
import { readBlockScalar, readDoubleQuotedScalar, readPlainScalar, readSingleQuotedScalar } from "./scalars";
import { isWhiteSpace, isWsOrEol, skipSeparationSpace } from "./scanner";
import type { Snapshot, State } from "./state";
import { beginSpeculation, restoreState, rollbackSpeculation, snapshotState, throwError } from "./state";

const CONTEXT_FLOW_IN = 1;
const CONTEXT_FLOW_OUT = 2;
const CONTEXT_BLOCK_IN = 3;
const CONTEXT_BLOCK_OUT = 4;

const readBlockSequence = (state: State, nodeIndent: number): boolean => {
    const savedTag = state.tag;
    const savedAnchor = state.anchor;
    const result: SeqTarget = state.build.seq();
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
        state.build.anchor(result, state.anchor);
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
            state.build.push(result, null);
            ch = state.input.charCodeAt(state.position);
            continue;
        }

        const { line } = state;

        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        state.build.push(result, state.result);
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
    const result = state.build.map();
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
        state.build.anchor(result, state.anchor);
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
    let result: MappingTarget | SeqTarget;

    if (ch === 0x5b) {
        terminator = 0x5d;
        isMapping = false;
        result = state.build.seq();
    } else if (ch === 0x7b) {
        terminator = 0x7d;
        isMapping = true;
        result = state.build.map();
    } else {
        return false;
    }

    if (state.anchor !== null) {
        state.build.anchor(result, state.anchor);
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
            // `[ key: value ]` — a single-pair mapping as one sequence entry.
            const pair = state.build.map();

            overridableKeys = storeMappingPair(state, pair, overridableKeys, keyTag, keyNode, valueNode);
            state.build.push(result as SeqTarget, pair);
        } else {
            state.build.push(result as SeqTarget, keyNode);
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

                // Finish before the anchor is recorded, so node mode registers
                // the node rather than the raw value. Returning early here used
                // to skip the wrap below entirely, leaving a custom implicit tag
                // as the only unwrapped value in an otherwise complete tree.
                state.result = state.build.finish(state, state.result, hasContent);

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

    state.result = state.build.finish(state, state.result, hasContent);

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

export { composeNode, CONTEXT_BLOCK_OUT };
