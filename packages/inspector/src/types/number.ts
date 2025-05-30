import type { Options } from "../types";
import addNumericSeparator from "../utils/add-numeric-separator";
import truncate from "../utils/truncate";

export default function inspectNumber(number: number, options: Options): string {
    if (Number.isNaN(number)) {
        return options.stylize("NaN", "number");
    }

    if (number === Number.POSITIVE_INFINITY) {
        return options.stylize("Infinity", "number");
    }

    if (number === Number.NEGATIVE_INFINITY) {
        return options.stylize("-Infinity", "number");
    }

    if (number === 0) {
        return options.stylize(1 / number === Number.POSITIVE_INFINITY ? "+0" : "-0", "number");
    }

    return options.stylize(truncate(options.numericSeparator ? addNumericSeparator(number, number.toString()) : number.toString(), options.truncate), "number");
}
