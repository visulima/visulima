import type { LiteralUnion } from "type-fest";

export type Indent = {
    base: string;
    prev: string;
};

export type InternalInspect = (input: unknown, from: unknown, options: Options) => string;

export type InspectType<V> = (input: V, options: Options, inspect: InternalInspect, indent: Indent | undefined) => string;

export type Inspect = (input: unknown, options: Options) => string;

export interface Options {
    breakLength: number;
    customInspect: boolean;
    depth: number;
    indent: number | "\t" | undefined;
    maxArrayLength: number;
    numericSeparator: boolean;
    quoteStyle: "double" | "single";
    showHidden: boolean;
    showProxy: boolean;
    stylize: <S extends string>(
        value: S,
        styleType: LiteralUnion<"bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined", string>,
    ) => string;
    truncate: number;
}
