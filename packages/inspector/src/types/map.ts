import type { Inspect, Options } from "../types";
import inspectList from "../utils/inspect-list";

const inspectMapEntry = ([key, value]: [unknown, unknown], options: Options): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    // eslint-disable-next-line no-param-reassign
    key = options.inspect(key, options);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    return `${key as string} => ${options.inspect(value, options)}`;
}

const inspectMap = (map: Map<unknown, unknown>, options: Options): string => {
    const size = map.size - 1;
    if (size <= 0) {
        return "Map{}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 7;

    return `Map{ ${inspectList([...map.entries()], options, inspectMapEntry as Inspect)} }`;
}

export default inspectMap;
