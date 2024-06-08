import { inspectList } from "../helpers";
import type { Options } from "../types";

const inspectArguments = (arguments_: IArguments, options: Options): string => {
    if (arguments_.length === 0) {
        return "Arguments[]";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 13;

    return `Arguments[ ${inspectList(arguments_, options)} ]`;
}

export default inspectArguments;
