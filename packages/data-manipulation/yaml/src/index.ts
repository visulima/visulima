import { YAMLDocument } from "./document";
import { dump as dumpValue } from "./parser/dumper";
import { loadAll as loadAllDocuments, loadDocuments, loadOne } from "./parser/loader";
import type { ParseOptions, StringifyOptions } from "./types";

// The `js-yaml`-style aliases default to `strict: false` so they stay
// byte-for-byte drop-in replacements for `js-yaml`, which is lenient about the
// corner cases strict mode rejects. The native `parse`/`parseAll` keep
// strict on by default. An explicit `strict` in the caller's options wins.
const LENIENT_DEFAULTS: ParseOptions = { strict: false };

/** Stand-in for `parseDocument` on empty input: no contents, no diagnostics. */
// eslint-disable-next-line unicorn/no-null
const EMPTY_DOCUMENT = { contents: null, errors: [], warnings: [] };

export { YAMLDocument } from "./document";
export type { Mark } from "./errors";
export { YAMLError, YAMLParseError, YAMLStringifyError, YAMLWarning } from "./errors";

/**
 * Parse the first document of a YAML string into a native JavaScript value.
 *
 * This is the `yaml`-style entry point. Use {@link parseAll} for multi-document
 * streams.
 * @example
 * ```ts
 * import { parse } from "@visulima/yaml";
 *
 * parse("foo: bar"); // => { foo: "bar" }
 * ```
 */
export function parse(source: string, options?: ParseOptions): unknown;
export function parse(source: string, reviver?: ParseOptions["reviver"], options?: ParseOptions): unknown;

/**
 * Parse the first document of a YAML string into a native JavaScript value.
 *
 * Accepts the `JSON.parse`-shaped `(source, reviver, options)` form as well as
 * `(source, options)`.
 */
export function parse(source: string, reviverOrOptions?: ParseOptions | ParseOptions["reviver"], maybeOptions?: ParseOptions): unknown {
    if (typeof reviverOrOptions === "function") {
        return loadOne(source, { ...maybeOptions, reviver: reviverOrOptions });
    }

    return loadOne(source, reviverOrOptions ?? maybeOptions);
}

/**
 * Parse every document of a multi-document YAML stream, returning them in order.
 * @example
 * ```ts
 * import { parseAll } from "@visulima/yaml";
 *
 * parseAll("---\na: 1\n---\nb: 2"); // => [{ a: 1 }, { b: 2 }]
 * ```
 */
export const parseAll = (source: string, options?: ParseOptions): unknown[] => loadAllDocuments(source, options);

/**
 * Serialize a JavaScript value to a YAML document string.
 * @example
 * ```ts
 * import { stringify } from "@visulima/yaml";
 *
 * stringify({ foo: "bar" }); // => "foo: bar\n"
 * ```
 */
export function stringify(value: unknown, options?: StringifyOptions): string;
export function stringify(value: unknown, replacer?: StringifyOptions["replacer"] | unknown[] | null, options?: StringifyOptions | number | string): string;

/**
 * Serialize a JavaScript value to a YAML document string.
 *
 * Accepts the `JSON.stringify`-shaped `(value, replacer, space)` form as well as
 * `(value, options)`. `space` sets the indentation width; a string is measured
 * by its length, matching `yaml`.
 */
export function stringify(
    value: unknown,
    replacerOrOptions?: StringifyOptions | StringifyOptions["replacer"] | unknown[] | null,
    maybeOptions?: StringifyOptions | number | string,
): string {
    const isReplacer = typeof replacerOrOptions === "function" || Array.isArray(replacerOrOptions) || replacerOrOptions === null;

    if (!isReplacer && replacerOrOptions !== undefined) {
        return dumpValue(value, replacerOrOptions);
    }

    let options: StringifyOptions = {};

    if (typeof maybeOptions === "number") {
        options = { indent: maybeOptions };
    } else if (typeof maybeOptions === "string") {
        options = { indent: maybeOptions.length };
    } else if (maybeOptions) {
        options = maybeOptions;
    }

    // An array replacer is the `JSON.stringify` allowlist form: keep only those
    // keys.
    if (Array.isArray(replacerOrOptions)) {
        const allowed = new Set(replacerOrOptions.map(String));

        return dumpValue(value, {
            ...options,
            replacer: (key, item) => {
                if (key === "" || allowed.has(key)) {
                    return item;
                }

                return undefined;
            },
        });
    }

    if (typeof replacerOrOptions === "function") {
        return dumpValue(value, { ...options, replacer: replacerOrOptions });
    }

    return dumpValue(value, options);
}

/**
 * `js-yaml`-compatible alias of {@link parse}.
 *
 * Unlike {@link parse}, this defaults to `strict: false` to match `js-yaml`'s
 * leniency. Pass `{ strict: true }` for full YAML 1.2 strictness.
 */
export const load = (source: string, options?: ParseOptions): unknown => loadOne(source, { ...LENIENT_DEFAULTS, ...options });

/**
 * `js-yaml`-compatible multi-document loader.
 *
 * When an `iterator` is supplied it is invoked once per document (matching the
 * `js-yaml` signature); otherwise the parsed documents are returned as an array.
 * Like {@link load}, this defaults to `strict: false`.
 */
export function loadAll(source: string, iterator: (document: unknown) => void, options?: ParseOptions): void;
export function loadAll(source: string, options?: ParseOptions): unknown[];
export function loadAll(source: string, iteratorOrOptions?: ((document: unknown) => void) | ParseOptions, maybeOptions?: ParseOptions): unknown[] | void {
    if (typeof iteratorOrOptions === "function") {
        const documents = loadAllDocuments(source, { ...LENIENT_DEFAULTS, ...maybeOptions });

        for (const document of documents) {
            iteratorOrOptions(document);
        }

        return undefined;
    }

    return loadAllDocuments(source, { ...LENIENT_DEFAULTS, ...iteratorOrOptions });
}

/**
 * `js-yaml`-compatible alias of {@link stringify}.
 */
export const dump = (value: unknown, options?: StringifyOptions): string => dumpValue(value, options);

/**
 * Parse a document into a node tree — `Scalar` / `YAMLMap` / `YAMLSeq` / `Pair`
 * / `Alias` — preserving what native values cannot: scalar styles, tags,
 * anchors, and aliases as references rather than resolved copies.
 *
 * Separate from {@link parse}, which never builds a tree; that is what keeps
 * its single-pass path fast.
 */
export const parseNodes = (source: string, options?: ParseOptions): unknown => {
    const { documents } = loadDocuments(source, { ...options, nodes: true });

    return documents[0]?.contents;
};

/** Every document of a stream as node trees. */
export const parseAllNodes = (source: string, options?: ParseOptions): unknown[] => {
    const { documents } = loadDocuments(source, { ...options, nodes: true });

    return documents.map((document) => document.contents);
};

/**
 * Parse the first document without throwing, returning a {@link YAMLDocument}
 * that carries its own diagnostics and supports comment-preserving edits.
 * @example
 * ```ts
 * const document = parseDocument("a: 1 # keep me");
 *
 * document.setIn(["b", "c"], 2);
 * document.toString(); // "a: 1 # keep me\nb:\n  c: 2\n"
 * ```
 */
export const parseDocument = (source: string, options?: ParseOptions): YAMLDocument => {
    const { documents, ranges } = loadDocuments(source, { ...options, nodes: true });

    return new YAMLDocument(source, documents[0] ?? EMPTY_DOCUMENT, ranges);
};

/**
 * Parse every document of a stream without throwing. A malformed document
 * reports its error and does not stop the ones after it.
 */
export const parseAllDocuments = (source: string, options?: ParseOptions): YAMLDocument[] => {
    const { documents, ranges } = loadDocuments(source, { ...options, nodes: true });

    return documents.map((document) => new YAMLDocument(source, document, ranges));
};

export type { NodeKindName, ScalarStyle } from "./nodes/nodes";
export {
    Alias,
    Collection,
    createNode,
    isAlias,
    isCollection,
    isMap,
    isNode,
    isPair,
    isScalar,
    isSeq,
    Pair,
    Scalar,
    toJS,
    YAMLMap,
    YAMLSeq,
} from "./nodes/nodes";
export type { Visitor, VisitorFunction } from "./nodes/visit";
export { visit } from "./nodes/visit";
export type { DuplicateKeyBehavior, ParseOptions, StringifyOptions } from "./types";
