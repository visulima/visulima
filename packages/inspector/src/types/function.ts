import { truncate } from "../helpers";
import type { Options } from "../types";

type ToStringable = Function & { [Symbol.toStringTag]: string };

const inspectFunction = (function_: ToStringable, options: Options): string => {
    const functionType = function_[Symbol.toStringTag] || "Function";
    const source = function_.toString();

    if (source.length < options.truncate - 12) {
        return options.stylize(`[${functionType}: ${source}]`, "special");
    }

    const { name } = function_;

    if (!name) {
        return options.stylize(`[${functionType}]`, "special");
    }

    return options.stylize(`[${functionType} ${truncate(name, options.truncate - 11)}]`, "special");
};

export default inspectFunction;
