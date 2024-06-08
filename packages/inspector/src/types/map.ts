import { inspectList } from "../helpers";
import type { Inspect, Options } from "../types";

function inspectMapEntry([key, value]: [unknown, unknown], options: Options): string {
    options.truncate -= 4;
    key = options.inspect(key, options);
    options.truncate -= (key as string).length;
    value = options.inspect(value, options);
    return `${key} => ${value}`;
}

// IE11 doesn't support `map.entries()`
function mapToEntries<K, V>(map: Map<K, V>): [K, V][] {
    const entries: [K, V][] = [];
    map.forEach((value, key) => {
        entries.push([key, value]);
    });
    return entries;
}

export default function inspectMap(map: Map<unknown, unknown>, options: Options): string {
    const size = map.size - 1;
    if (size <= 0) {
        return "Map{}";
    }
    options.truncate -= 7;
    return `Map{ ${inspectList(mapToEntries(map), options, inspectMapEntry as Inspect)} }`;
}
