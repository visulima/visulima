import type { InspectType, Options } from "../types";
import inspectList from "../utils/inspect-list";

const inspectArguments: InspectType<IArguments> = (arguments_: IArguments, options: Options, inspect): string => {
    if (arguments_.length === 0) {
        return "Arguments []";
    }

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 13;

    return `Arguments [ ${inspectList(arguments_, arguments_, options, inspect)} ]`;
};

export default inspectArguments;
