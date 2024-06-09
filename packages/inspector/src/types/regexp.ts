import type { Options } from "../types";
import truncate from "../utils/truncate";

const inspectRegExp = (regExp: RegExp, options: Options): string => {
    const sourceLength = options.truncate - (2 + (regExp.flags as string).length);

    return options.stylize(`/${truncate(regExp.source, sourceLength)}/${regExp.flags}`, "regexp");
}

export default inspectRegExp;
