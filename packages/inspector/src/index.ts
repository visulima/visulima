import { internalInspect } from "./internal-inspect";
import type { Options } from "./types";

export { registerConstructor, registerStringTag } from "./internal-inspect";

export const inspect = (value: unknown, options_: Partial<Options> = {}): string => {
    const options = {
        breakLength: Number.POSITIVE_INFINITY,
        compact: 3,
        customInspect: true,
        depth: 5,
        getters: false,
        indent: undefined,
        maxArrayLength: Number.POSITIVE_INFINITY,
        maxStringLength: Number.POSITIVE_INFINITY,
        numericSeparator: true,
        quoteStyle: "single",
        showHidden: false,
        showProxy: false,
        sorted: false,
        stylize: <S extends string>(s: S) => s.toString(),
        ...options_,
    } satisfies Options;

    if ((options.compact === false || options.breakLength !== Number.POSITIVE_INFINITY) && options.indent === undefined) {
        options.indent = 2;
    }

    if (options.indent !== undefined && options.indent !== "\t" && !(Number.parseInt(options.indent as unknown as string, 10) === options.indent && options.indent > 0)) {
        throw new TypeError("option \"indent\" must be \"\\t\", an integer > 0, or `undefined`");
    }

    return internalInspect(value, options, 0, []);
};

export type { Options } from "./types";
