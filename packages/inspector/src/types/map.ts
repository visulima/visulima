import type { Inspect, InspectType, Options } from "../types";
import inspectList from "../utils/inspect-list";

const inspectMapEntry: InspectType<[unknown, unknown]> = ([key, value]: [unknown, unknown], options: Options, inspect: Inspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    // eslint-disable-next-line no-param-reassign
    key = inspect(key, options);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    return `${key as string} => ${inspect(value, options)}`;
}

const inspectMap: InspectType<Map<unknown, unknown>> = (map: Map<unknown, unknown>, options: Options, inspect: Inspect): string => {
    const size = map.size - 1;
    if (size <= 0) {
        return "Map{}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 7;

    return `Map{ ${inspectList([...map.entries()], options, inspect, inspectMapEntry)} }`;
}

export default inspectMap;
