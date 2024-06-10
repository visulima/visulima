export type Indent = {
    base: string;
    prev: string;
};

export type InternalInspect = (value: unknown, from: unknown, options: Options) => string;

export type InspectType<V> = (value: V, options: Options, inspect: InternalInspect, indent: Indent | undefined) => string;

export type Inspect = (value: unknown, options: Options) => string;

export interface Options {
    breakLength: number;
    colors: boolean;
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
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
        styleType: string | "bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined",
    ) => string;
    truncate: number;
}
