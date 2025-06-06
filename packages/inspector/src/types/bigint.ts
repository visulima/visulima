import { TRUNCATOR } from "../constants";
import type { Options } from "../types";
import addNumericSeparator from "../utils/add-numeric-separator";
import truncate from "../utils/truncate";

const inspectBigInt = (number: bigint, options: Options): string => {
    let nums = truncate(number.toString(), options.maxStringLength - 1);

    if (nums !== TRUNCATOR) {
        nums += "n";
    }

    return options.stylize(options.numericSeparator ? addNumericSeparator(number, nums) : nums, "bigint");
};

export default inspectBigInt;
