import { TRUNCATOR } from "../constants";
import type { Options } from "../types";
import truncate from "../utils/truncate";

const inspectBigInt = (number: bigint, options: Options): string => {
    let nums = truncate(number.toString(), options.truncate - 1);

    if (nums !== TRUNCATOR) {
        nums += "n";
    }

    return options.stylize(nums, "bigint");
}

export default inspectBigInt;
