import type { Indent, InspectType, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";

const inspectSet: InspectType<Set<unknown>> = (set: Set<unknown>, options: Options, inspect, indent: Indent | undefined): string => {
    if (set.size === 0) {
        return "Set (0) {}";
    }

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 7;

    const entries = [...set];

    if (options.sorted) {
        entries.sort((a, b) => {
            if (typeof options.sorted === "function") {
                return options.sorted(String(a), String(b));
            }

            return String(a).localeCompare(String(b));
        });
    }

    let returnValue = inspectList(entries, set, options, inspect);

    if (indent) {
        returnValue = indentedJoin(returnValue, indent);
    }

    return `Set (${set.size}) {${indent ? "" : " "}${returnValue}${indent ? "" : " "}}`;
};

export default inspectSet;
