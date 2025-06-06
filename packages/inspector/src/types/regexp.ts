import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";

const inspectRegExp: InspectType<RegExp> = (value: RegExp, options: Options): string => {
    const sourceLength = options.maxStringLength - (2 + (value.flags as string).length);

    return options.stylize(`/${truncate(value.source, sourceLength)}/${value.flags}`, "regexp");
};

export default inspectRegExp;
