import { internalInspect } from "../internal-inspect";
import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";

const inspectMapEntry = ([key, value]: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 4;

    // eslint-disable-next-line no-param-reassign
    key = inspect(key, object, options);

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= (key as string).length;

    return `${key as string} => ${inspect(value, object, options)}`;
};

const inspectMap: InspectType<Map<unknown, unknown>> = (
    map: Map<unknown, unknown>,
    options: Options,
    inspect: InternalInspect,
    indent: Indent | undefined,
    depth: number,
): string => {
    if (map.size <= 0) {
        return "Map (0) {}";
    }

    const entries = [...map.entries()];

    if (options.sorted) {
        entries.sort((a, b) => {
            if (typeof options.sorted === "function") {
                return options.sorted(String(a[0]), String(b[0]));
            }

            return String(a[0]).localeCompare(String(b[0]));
        });
    }

    let breakLines: boolean = false;

    if (options.breakLength) {
        const temporaryOptions = { ...options, compact: false, maxStringLength: Number.POSITIVE_INFINITY };
        const listContentsForCheck = inspectList(entries, map, temporaryOptions, inspect, inspectMapEntry);
        const singleLineOutput = `Map (${map.size}) { ${listContentsForCheck} }`;

        breakLines = singleLineOutput.length > options.breakLength;
    }

    const multiline = (options.compact === false || (typeof options.compact === "number" && depth >= options.compact) || breakLines) && indent !== undefined;

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 7;

    const inspectWithIndent = (value: unknown, from: unknown, indexOptions: Options) => internalInspect(value, indexOptions, depth + 1, [from]);

    let returnValue = inspectList(entries, map, options, inspectWithIndent, inspectMapEntry);

    if (multiline) {
        returnValue = indentedJoin(returnValue, indent as Indent);
    }

    return `Map (${map.size}) {${multiline ? "" : " "}${returnValue}${multiline ? "" : " "}}`;
};

export default inspectMap;
