import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";

const inspectMapEntry = ([key, value]: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    // eslint-disable-next-line no-param-reassign
    key = inspect(key, object, options);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    return `${key as string} => ${inspect(value, object, options)}`;
};

const inspectMap: InspectType<Map<unknown, unknown>> = (
    map: Map<unknown, unknown>,
    options: Options,
    inspect: InternalInspect,
    indent: Indent | undefined,
): string => {
    if (map.size <= 0) {
        return "Map (0) {}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 7;

    let returnValue = inspectList([...map.entries()], map, options, inspect, inspectMapEntry);

    if (indent) {
        returnValue = indentedJoin(returnValue, indent);
    }

    return `Map (${map.size}) {${indent ? "" : " "}${returnValue}${indent ? "" : " "}}`;
};

export default inspectMap;
