/*
 * Part of the hand-written parser; the file-scope disables mirror `loader.ts`.
 */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * Node properties: the tag, anchor and alias tokens that may precede a node.
 *
 * These read the cursor but never compose a node, so the composer imports them
 * and they import nothing back.
 */

import { isFlowIndicator, isWsOrEol } from "./scanner";
import type { State } from "./state";
import { throwError } from "./state";

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

    // In node mode an alias stays a reference; `toJS` resolves it later, which
    // is what lets a document round-trip with its aliases intact.
    state.result = state.build.alias(state, alias);
    state.kind = "scalar";

    return true;
};

export { readAlias, readAnchorProperty, readTagProperty };
