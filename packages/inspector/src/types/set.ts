import { internalInspect } from "../internal-inspect";
import type { Indent, InspectType, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";

const inspectSet: InspectType<Set<unknown>> = (set: Set<unknown>, options: Options, inspect, indent: Indent | undefined, depth: number): string => {
    if (set.size === 0) {
        return "Set (0) {}";
    }

    const entries = [...set];

    if (options.sorted) {
        entries.sort((a, b) => {
            if (typeof options.sorted === "function") {
                return options.sorted(String(a), String(b));
            }

            return String(a).localeCompare(String(b));
        });
    }

    let breakLines: boolean = false;

    if (options.breakLength) {
        const temporaryOptions = { ...options, compact: false, maxStringLength: Number.POSITIVE_INFINITY };
        const listContentsForCheck = inspectList(entries, set, temporaryOptions, inspect);
        const singleLineOutput = `Set (${set.size}) { ${listContentsForCheck} }`;

        breakLines = singleLineOutput.length > options.breakLength;
    }

    const multiline = (options.compact === false || (typeof options.compact === "number" && depth >= options.compact) || breakLines) && indent !== undefined;

    if (options.maxStringLength !== null) {
        // eslint-disable-next-line no-param-reassign
        options.maxStringLength -= 7;
    }

    const inspectWithIndent = (value: unknown, from: unknown, indexOptions: Options) => internalInspect(value, indexOptions, depth + 1, [from]);

    let returnValue = inspectList(entries, set, options, inspectWithIndent);

    if (multiline) {
        returnValue = indentedJoin(returnValue, indent as Indent);
    }

    return `Set (${set.size}) {${multiline ? "" : " "}${returnValue}${multiline ? "" : " "}}`;
};

export default inspectSet;
