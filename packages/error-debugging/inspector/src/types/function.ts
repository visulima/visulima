import { INSPECTION_THREW } from "../constants";
import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ToStringable = Function & { [Symbol.toStringTag]: string };

const inspectFunction: InspectType<ToStringable> = (function_: ToStringable, options: Options): string => {
    let functionType: string;
    let source: string;
    let name: string;

    try {
        functionType = function_[Symbol.toStringTag] || "Function";
        source = function_.toString();
        ({ name } = function_);
    } catch {
        // `typeof` reports "function" for a revoked proxy over a callable, but every
        // read on it — including `toString` — throws, so it reaches this inspector
        // with nothing observable about it.
        return options.stylize(INSPECTION_THREW, "special");
    }

    if (source.length < options.truncate - 12) {
        return options.stylize(`[${functionType}: ${source}]`, "special");
    }

    if (!name) {
        return options.stylize(`[${functionType}]`, "special");
    }

    return options.stylize(`[${functionType} ${truncate(name, options.truncate - 11)}]`, "special");
};

export default inspectFunction;
