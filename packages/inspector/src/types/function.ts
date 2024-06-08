import { truncate } from "../helpers";
import type { Options } from "../types";

type ToStringable = Function & { [Symbol.toStringTag]: string };

export default function inspectFunction(function_: ToStringable, options: Options) {
    const functionType = function_[Symbol.toStringTag] || "Function";

    const { name } = function_;
    if (!name) {
        return options.stylize(`[${functionType}]`, "special");
    }
    return options.stylize(`[${functionType} ${truncate(name, options.truncate - 11)}]`, "special");
}
