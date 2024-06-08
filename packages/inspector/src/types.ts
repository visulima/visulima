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
    stylize: (value: string, styleType: string) => string;
    truncate: number;
}
