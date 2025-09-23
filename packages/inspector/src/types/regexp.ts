import { TRUNCATOR } from "../constants";
import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";

const inspectRegExp: InspectType<RegExp> = (value: RegExp, options: Options): string => {
    const sourceLength = options.maxStringLength - (2 + (value.flags as string).length);

    let truncated = truncate(value.source, sourceLength);

    if (truncated === "") {
        truncated = TRUNCATOR;
    }

    return options.stylize(`/${truncated}/${value.flags}`, "regexp");
};

export default inspectRegExp;
