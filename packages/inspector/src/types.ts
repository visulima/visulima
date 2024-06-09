export type Inspect = (value: unknown, options: Options) => string;

export interface Options {
    breakLength: number;
    colors: boolean;
    customInspect: boolean;
    depth: number;
    inspect: Inspect;
    maxArrayLength: number;
    seen: unknown[];
    showHidden: boolean;
    showProxy: boolean;
    stylize: <S extends string>(
        value: S,
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
        styleType: string | "bigint" | "boolean" | "date" | "null" | "number" | "regexp" | "special" | "string" | "symbol" | "undefined",
    ) => string;
    truncate: number;
}
