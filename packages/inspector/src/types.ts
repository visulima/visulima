import type { LiteralUnion } from "type-fest";

export type Indent = {
    base: string;
    prev: string;
};

export type InternalInspect = (input: unknown, from: unknown, options: Options) => string;

export type InspectType<V> = (input: V, options: Options, inspect?: InternalInspect, indent?: Indent, depth?: number) => string;

export type Inspect = (input: unknown, options: Options) => string;

export interface Options {
    /**
     * The length at which input values are split across multiple lines.
     * Set to `Infinity` to format the input as a single line (in combination with compact set to true or any number >= 1).
     * @default Number.POSITIVE_INFINITY
     */
    breakLength: number;

    /**
     * Setting this to `false` causes each object key to be displayed on a new line.
     * It will break on new lines in text that is longer than `breakLength`.
     * If set to a number, the most `n` inner elements are united on a single line as long as all properties fit into `breakLength`.
     * Short array elements are also grouped together.
     * @default 3
     */
    compact: boolean | number;

    /**
     * If `false`, `[util.inspect.custom](depth, opts, inspect)` functions are not invoked.
     * @default true
     */
    customInspect: boolean;

    /**
     * Specifies the number of times to recurse while formatting object.
     * This is useful for inspecting large objects.
     * To recurse up to the maximum call stack size pass `Infinity` or `undefined`.
     * @default 5
     */
    depth: number | undefined;

    /**
     * If set to `true`, getters are inspected.
     * If set to `'get'`, only getters without a corresponding setter are inspected.
     * If set to `'set'`, only getters with a corresponding setter are inspected.
     * This might cause side effects depending on the getter function.
     * @default false
     */
    getters: boolean | "get" | "set";

    /**
     * The indentation to use for formatting.
     * Can be a number of spaces or a tab character.
     * @internal
     */
    indent: number | "\t" | undefined;

    /**
     * Specifies the maximum number of `Array`, `&lt;TypedArray>`, `&lt;Map>`, `&lt;WeakMap>`, and `&lt;WeakSet>` elements to include when formatting.
     * Set to `null` or `Infinity` to show all elements. Set to `0` or negative to show no elements.
     * @default Number.POSITIVE_INFINITY
     */
    maxArrayLength: number;

    /**
     * Specifies the maximum number of characters to include when formatting.
     * Set to `null` or `Infinity` to show all elements. Set to `0` or negative to show no characters.
     * @default Number.POSITIVE_INFINITY
     */
    maxStringLength: number;

    /**
     * If set to `true`, an underscore is used to separate every three digits in all bigints and numbers.
     * @default false
     */
    numericSeparator: boolean;

    /**
     * The quote style to use for strings.
     * @default "single"
     * @internal
     */
    quoteStyle: "double" | "single";

    /**
     * If `true`, object's non-enumerable symbols and properties are included in the formatted result.
     * `&lt;WeakMap>` and `&lt;WeakSet>` entries are also included as well as user defined prototype properties (excluding method properties).
     * @default false
     */
    showHidden: boolean;

    /**
     * If `true`, `Proxy` inspection includes the target and handler objects.
     * @default false
     */
    showProxy: boolean;

    /**
     * If set to `true` or a function, all properties of an object, and `Set` and `Map` entries are sorted in the resulting string.
     * If set to `true` the default sort is used. If set to a function, it is used as a compare function.
     */
    sorted: boolean | ((a: string, b: string) => number);

    /**
     * A function to stylize the output.
     * @internal
     */
    stylize: <S extends string>(
        value: S,
        styleType: LiteralUnion<"bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined", string>,
    ) => string;
}

export type InternalOptions = Options & {
    proxyHandler?: InspectType<typeof Proxy>;
};
