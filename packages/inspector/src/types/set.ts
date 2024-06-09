import type { Options } from "../types";
import inspectList from "../utils/inspect-list";

const inspectSet = (set: Set<unknown>, options: Options): string => {
    if (set.size === 0) {
        return "Set{}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 7;

    return `Set{ ${inspectList([...set], options)} }`;
}

export default inspectSet;
