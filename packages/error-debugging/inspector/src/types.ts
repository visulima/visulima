import type { LiteralUnion } from "type-fest";

export type Indent = {
    base: string;
    prev: string;
};

export type InternalInspect = (input: unknown, from: unknown, options: Options) => string;

export type InspectType<V> = (input: V, options: Options, inspect: InternalInspect, indent: Indent | undefined) => string;

export type Inspect = (input: unknown, options: Options) => string;

export interface Options {
    /**
     * When `true`, honour custom inspectors: a value's
     * `Symbol.for("nodejs.util.inspect.custom")` method (Node only),
     * `Symbol.for("chai/inspect")` method, an `.inspect()` method, or a handler
     * registered via {@link registerConstructor} / {@link registerStringTag}.
     *
     * @default true
     */
    customInspect: boolean;

    /**
     * The maximum nesting depth to traverse before collapsing a nested value to
     * `[Object]` / `[Array]`. A value `<= 0` disables the limit.
     *
     * @default 5
     */
    depth: number;

    /**
     * Pretty-print with indentation. `"\t"` indents with tabs, a positive integer
     * indents with that many spaces, and `undefined` keeps everything on one line.
     *
     * @default undefined
     */
    indent: number | "\t" | undefined;

    /**
     * The maximum number of array / typed-array / iterable elements to render
     * before the remainder is replaced with an `… (N more)` marker. Use
     * `Number.POSITIVE_INFINITY` to show every element.
     *
     * @default Number.POSITIVE_INFINITY
     */
    maxArrayLength: number;

    /**
     * When `true`, render large numbers and bigints with `_` digit-group
     * separators (e.g. `1_000_000`).
     *
     * @default true
     */
    numericSeparator: boolean;

    /**
     * The quote character used when rendering string values and complex object
     * keys.
     *
     * @default "single"
     */
    quoteStyle: "double" | "single";

    /**
     * When `true`, also render non-enumerable own properties of plain objects
     * (mirrors `util.inspect`'s `showHidden`).
     *
     * @default false
     */
    showHidden: boolean;

    /**
     * Colourize / decorate a rendered fragment. Receives the raw fragment and a
     * style hint and must return the (optionally wrapped) string. Defaults to the
     * identity function.
     */
    stylize: (
        value: string,
        styleType: LiteralUnion<"bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined", string>,
    ) => string;

    /**
     * The maximum length (in characters) of a single rendered value before it is
     * truncated with an ellipsis. Use `Number.POSITIVE_INFINITY` to disable
     * truncation.
     *
     * @default Number.POSITIVE_INFINITY
     */
    truncate: number;
}
