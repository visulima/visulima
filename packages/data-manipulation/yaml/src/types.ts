import type { YAMLWarning } from "./errors";

/**
 * How duplicate keys in a mapping are handled.
 *
 * - `error` (default): throw a `YAMLParseError`.
 * - `overwrite`: keep the last value.
 * - `ignore`: keep the first value.
 */
export type DuplicateKeyBehavior = "error" | "ignore" | "overwrite";

/** Options accepted by `parse`. */
export interface ParseOptions {
    /**
     * How to treat repeated keys inside a single mapping.
     * @default "error"
     */
    duplicateKeys?: DuplicateKeyBehavior;

    /**
     * When `true`, mapping keys that are not plain strings/numbers keep their
     * native representation. When `false`, keys are coerced to strings (closer
     * to `JSON.parse` behaviour).
     * @default true
     */
    keepNonStringKeys?: boolean;

    /**
     * Maximum number of alias nodes that may be resolved. Guards against
     * "billion laughs" style alias-expansion attacks.
     * @default 100
     */
    maxAliasCount?: number;

    /**
     * Optional callback invoked for every non-fatal `YAMLWarning`. When
     * omitted, warnings are silently ignored.
     */
    onWarning?: (warning: YAMLWarning) => void;

    /**
     * When `true`, `__proto__` / `constructor` / `prototype` mapping keys are
     * dropped instead of being assigned (prototype-pollution guard).
     * @default true
     */
    preventProtoPollution?: boolean;
}

/** A user-supplied scalar style hint used when serializing. */
export type ScalarStyle = "double" | "folded" | "literal" | "plain" | "single";

/** Options accepted by `stringify`. */
export interface StringifyOptions {
    /**
     * Emit an explicit document-start marker (`---`) before the document.
     * @default false
     */
    directives?: boolean;

    /**
     * Force flow style (`{a: 1, b: [2, 3]}`) for collections nested deeper than
     * this level. `-1` disables flow style entirely (everything is block
     * style). `0` makes the whole document flow style.
     * @default -1
     */
    flowLevel?: number;

    /**
     * When `true`, non-ASCII characters are escaped in double-quoted scalars.
     * @default false
     */
    forceQuotes?: boolean;

    /**
     * Number of spaces used for each indentation level.
     * @default 2
     */
    indent?: number;

    /**
     * Preferred maximum line width for folded scalars. `0` disables folding.
     * @default 80
     */
    lineWidth?: number;

    /**
     * A `JSON.stringify`-style replacer applied to every value before it is
     * serialized. Return `undefined` to omit the value.
     */
    replacer?: (key: string, value: unknown) => unknown;

    /**
     * When `true`, keys with `undefined` values (and `undefined` array members)
     * are skipped instead of being written as `null`.
     * @default false
     */
    skipInvalid?: boolean;

    /**
     * When `true`, object keys are emitted in sorted order. A comparator can be
     * supplied for custom ordering.
     * @default false
     */
    sortKeys?: boolean | ((a: string, b: string) => number);
}
