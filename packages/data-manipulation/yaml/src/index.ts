import { dump as dumpValue } from "./parser/dumper";
import { loadAll as loadAllDocuments, loadOne } from "./parser/loader";
import type { ParseOptions, StringifyOptions } from "./types";

// The `js-yaml`-style aliases default to `strict: false` so they stay
// byte-for-byte drop-in replacements for `js-yaml`, which is lenient about the
// corner cases strict mode rejects. The native `parse`/`parseAll` keep
// strict on by default. An explicit `strict` in the caller's options wins.
const LENIENT_DEFAULTS: ParseOptions = { strict: false };

export type { Mark } from "./errors";
export { YAMLError, YAMLParseError, YAMLStringifyError, YAMLWarning } from "./errors";
export type { DuplicateKeyBehavior, ParseOptions, StringifyOptions } from "./types";

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
export const parse = (source: string, options?: ParseOptions): unknown => loadOne(source, options);

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
export const stringify = (value: unknown, options?: StringifyOptions): string => dumpValue(value, options);

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
