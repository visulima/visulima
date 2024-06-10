import type { InspectType, Options } from "../types";
import inspectList from "../utils/inspect-list";

const inspectSet: InspectType<Set<unknown>> = (set: Set<unknown>, options: Options, inspect): string => {
    if (set.size === 0) {
        return "Set{}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 7;

    return `Set{ ${inspectList([...set], options, inspect)} }`;
}

export default inspectSet;
