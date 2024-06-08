import { truncate, truncator } from "../helpers";
import type { Options } from "../types";

const inspectBigInt = (number: bigint, options: Options): string => {
    let nums = truncate(number.toString(), options.truncate - 1);

    if (nums !== truncator) {
        nums += "n";
    }

    return options.stylize(nums, "bigint");
}

export default inspectBigInt;
