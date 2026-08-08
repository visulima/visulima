/**
 * How a parse accumulates collections.
 *
 * The parser can produce three different shapes — plain objects, `Map`s
 * (`mapAsMap`), or a `Scalar`/`YAMLMap`/`YAMLSeq` node tree (`parseNodes` /
 * `parseDocument`) — and which one is in play is decided once, from the options,
 * before any input is read.
 *
 * Selecting a builder up front replaces what used to be an `instanceof` chain at
 * every write site and a `state.nodes ?` at every construction site. Those
 * re-derived a constant decision on the hot path, and worse, each site could
 * disagree: merge keys were detected by comparing a key against `"&lt;&lt;"`, which
 * silently stopped matching once keys became `Scalar`s.
 *
 * All three builders are object literals declared with the same keys in the same
 * order, so they share one hidden class and the call sites stay monomorphic.
 */

/* eslint-disable no-param-reassign */
/* eslint-disable no-confusing-arrow */
/* eslint-disable sonarjs/cognitive-complexity */
/*
 * `toNode` is declared below the builder that calls it, so the three builders
 * stay adjacent and readable as a set.
 */
/* eslint-disable @typescript-eslint/no-use-before-define */

import { Alias, keyToString, Scalar, YAMLMap, YAMLSeq } from "../nodes/nodes";
import type { State } from "./state";

/** A mapping under construction. */
type MappingTarget = Map<unknown, unknown> | Record<string, unknown> | YAMLMap;

/** A sequence under construction. */
type SeqTarget = unknown[] | YAMLSeq;

const MERGE_TAG = "tag:yaml.org,2002:merge";

interface CollectionBuilder {
    /** The value an alias resolves to. */
    alias: (state: State, name: string) => unknown;

    /** Record an anchor on the collection itself, where the shape has one. */
    anchor: (target: MappingTarget | SeqTarget, name: string) => void;

    /** Finish a composed value: wrap it as a node, or pass it through. */
    finish: (state: State, value: unknown, hasContent: boolean) => unknown;

    /** Whether the mapping already holds `key`. */
    has: (target: MappingTarget, key: unknown) => boolean;

    /** Whether this key introduces a merge that must be applied while parsing. */
    isMergeKey: (keyTag: string | null, keyNode: unknown) => boolean;

    /** The key this mapping stores `keyNode` under. */
    key: (state: State, keyNode: unknown) => unknown;

    /** A new, empty mapping. */
    map: () => MappingTarget;

    /** Append to a sequence. */
    push: (target: SeqTarget, value: unknown) => void;

    /** A new, empty sequence. */
    seq: () => SeqTarget;

    /** Write one key. */
    set: (state: State, target: MappingTarget, key: unknown, value: unknown) => void;
}

/**
 * Whether `keyTag`/`keyNode` spell the merge key `&lt;&lt;`, for the two shapes that
 * apply merges while parsing.
 */
const isNativeMergeKey = (keyTag: string | null, keyNode: unknown): boolean => keyTag === MERGE_TAG || (keyTag === "?" && keyNode === "<<");

/**
 * Plain objects — the default, and the shape `parse` returns.
 *
 * A plain object can only carry string keys, so a collection key is flattened to
 * a stable string.
 */
const plainBuilder: CollectionBuilder = {
    alias: (state, name) => state.anchorMap.get(name),

    anchor: () => {
        // A plain object has nowhere to record one; the anchor map holds it.
    },

    finish: (_state, value) => value,

    has: (target, key) => Object.hasOwn(target, key as string),

    isMergeKey: isNativeMergeKey,

    key: (_state, keyNode) => keyToString(keyNode),

    map: () => {
        return {};
    },

    push: (target, value) => {
        (target as unknown[]).push(value);
    },

    seq: () => [],

    /**
     * `target[key] = value` is unsafe for `__proto__`: that name resolves to an
     * inherited accessor, so the assignment swaps the object's prototype instead
     * of creating a key. With the guard on it becomes an own data property,
     * which keeps the document's data and leaves the prototype untouched.
     *
     * `constructor` / `prototype` are written normally: `target` is always a
     * fresh object literal, so an own property of either name merely shadows a
     * harmless inherited one — dropping them lost data for no gain.
     */
    set: (state, target, key, value) => {
        if (key === "__proto__" && state.options.preventProtoPollution) {
            Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true });

            return;
        }

        (target as Record<string, unknown>)[key as string] = value;
    },
};

/**
 * `Map`s (`mapAsMap`), which can hold a collection as a key.
 *
 * The prototype chain is never in play here, so no write guard is needed.
 */
const mapBuilder: CollectionBuilder = {
    alias: (state, name) => state.anchorMap.get(name),

    anchor: () => {
        // As for plain objects: nowhere to put it.
    },

    finish: (_state, value) => value,

    has: (target, key) => (target as Map<unknown, unknown>).has(key),

    isMergeKey: isNativeMergeKey,

    // `stringKeys` asks for the flattened form even where native keys would work.
    key: (state, keyNode) => state.options.stringKeys ? keyToString(keyNode) : keyNode,

    map: () => new Map<unknown, unknown>(),

    push: (target, value) => {
        (target as unknown[]).push(value);
    },

    seq: () => [],

    set: (_state, target, key, value) => {
        (target as Map<unknown, unknown>).set(key, value);
    },
};

/**
 * The node tree.
 *
 * Keys keep their own nodes, so styles and tags survive. Merge keys are *not*
 * applied here: the `&lt;&lt;` pair and its `Alias` stay in the tree so the document
 * round-trips, and `toJS` splices the referenced mapping in — the same split the
 * `yaml` reference makes.
 *
 * `mapAsMap` has no meaning against this shape and is ignored.
 */
const nodeBuilder: CollectionBuilder = {
    alias: (_state, name) => new Alias(name),

    anchor: (target, name) => {
        (target as YAMLMap | YAMLSeq).anchor = name;
    },

    finish: (state, value, hasContent) => toNode(state, value, hasContent),

    has: (target, key) => (target as YAMLMap).has(key),

    isMergeKey: () => false,

    // Wrap a flattened key so the tree stays uniform — a bare string here would
    // be a `Pair.key` that `visit` skips and `isScalar` rejects.
    key: (state, keyNode) => state.options.stringKeys ? new Scalar(keyToString(keyNode)) : keyNode,

    map: () => new YAMLMap(),

    push: (target, value) => {
        (target as YAMLSeq).items.push(value);
    },

    seq: () => new YAMLSeq(),

    set: (_state, target, key, value) => {
        (target as YAMLMap).set(key, value);
    },
};

/**
 * Wrap a finished value as a node, carrying over the tag, anchor and the style
 * it was written in. Collections already are nodes by this point.
 */
const toNode = (state: State, value: unknown, hasContent: boolean): unknown => {
    if (value instanceof Alias) {
        return value;
    }

    // Already a node: the composer can run over the same result more than once
    // (a speculative parse that succeeds, a rewind that re-reads the value), and
    // wrapping twice would bury the value inside a second Scalar.
    if (value instanceof Scalar) {
        if (state.anchor !== null) {
            value.anchor = state.anchor;
        }

        if (state.tag !== null && state.tag !== "?" && state.tag !== "!") {
            value.tag = state.tag;
        }

        return value;
    }

    if (value instanceof YAMLMap || value instanceof YAMLSeq) {
        if (state.tag !== null && state.tag !== "?" && state.tag !== "!") {
            value.tag = state.tag;
        }

        return value;
    }

    const scalar = new Scalar(value);

    if (hasContent && state.scalarStyle) {
        scalar.type = state.scalarStyle;
    }

    if (state.anchor !== null) {
        scalar.anchor = state.anchor;
    }

    if (state.tag !== null && state.tag !== "?" && state.tag !== "!") {
        scalar.tag = state.tag;
    }

    return scalar;
};

/** Pick the builder a parse will use, once, from its options. */
const selectBuilder = (nodes: boolean, mapAsMap: boolean | undefined): CollectionBuilder => {
    if (nodes) {
        return nodeBuilder;
    }

    return mapAsMap ? mapBuilder : plainBuilder;
};

export type { CollectionBuilder, MappingTarget, SeqTarget };
export { selectBuilder };
