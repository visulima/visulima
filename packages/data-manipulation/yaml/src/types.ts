import type { YAMLWarning } from "./errors";
import type { SchemaName } from "./schema/schemas";

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
     * Maximum number of alias nodes that may be resolved. Guards against
     * "billion laughs" style alias-expansion attacks.
     * @default 100
     */
    maxAliasCount?: number;

    /**
     * Maximum nesting depth of collections. Guards against a deeply nested
     * document (`[[[[…`) exhausting the call stack with a `RangeError` that
     * escapes the `YAMLError` hierarchy.
     * @default 1000
     */
    maxDepth?: number;

    /**
     * Optional callback invoked for every non-fatal `YAMLWarning`. When
     * omitted, warnings are silently ignored.
     */
    onWarning?: (warning: YAMLWarning) => void;

    /**
     * When `true`, a `__proto__` mapping key becomes an own data property
     * instead of being assigned through the inherited setter, so a document can
     * never reach the prototype chain. Merge keys (`&lt;&lt;`) honour this too.
     * @default true
     */
    preventProtoPollution?: boolean;

    /**
     * Which scalar-resolution rules to apply.
     *
     * `core` (default) is YAML 1.2 core: `~`/`null`, `true`/`false`, decimal,
     * hex and octal ints, floats, `.inf`/`.nan`.
     * `failsafe` resolves nothing; every scalar stays a string.
     * `json` resolves only the JSON grammar; any other unquoted scalar is a
     * document error.
     * `yaml-1.1` is the older, wider set: `yes`/`no`/`on`/`off` as booleans,
     * `010` as octal, `0b` binaries, `1_000` underscores, sexagesimals, and
     * timestamps as `Date`.
     *
     * Defaults to `yaml-1.1` when {@link ParseOptions.version} is `"1.1"`.
     * @default "core"
     */
    schema?: SchemaName;

    /**
     * Full YAML 1.2 strictness, on by default. The parser always rejects the
     * unambiguous spec violations (tabs as indentation, malformed directives,
     * deficient indentation, comments not separated by white space). With
     * `strict` it additionally rejects the corner cases that both `yaml` and
     * `js-yaml` accept but the spec forbids: a node property (anchor or tag)
     * carried onto a new line yet indented no deeper than its parent key; a
     * block mapping or sequence whose first entry sits on the document-start
     * line; two anchors or two tags on one node; and a block scalar whose
     * leading empty lines out-indent its content or that uses a tab for
     * indentation. Set `strict: false` to relax exactly those checks (closer to
     * `js-yaml`); it never changes the value of an accepted document, only
     * whether these malformed inputs throw.
     * @default true
     */
    strict?: boolean;

    /**
     * YAML version to assume when the document carries no `%YAML` directive.
     * `"1.1"` selects the `yaml-1.1` schema unless {@link ParseOptions.schema}
     * says otherwise.
     * @default "1.2"
     */
    version?: "1.1" | "1.2";
}

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
