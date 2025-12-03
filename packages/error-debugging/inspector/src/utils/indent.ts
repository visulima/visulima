import type { Indent, Options } from "../types";

export const getIndent = (indent: Options["indent"], depth: Options["depth"]): Indent | undefined => {
    let baseIndent;

    if (indent === "\t") {
        baseIndent = "\t";
    } else if (typeof indent === "number" && indent > 0) {
        baseIndent = Array.from({ length: indent + 1 }).join(" ");
    } else {
        return undefined;
    }

    return {
        base: baseIndent,
        prev: `\n${Array.from({ length: depth + 1 }).join(baseIndent)}`,
    };
};

export const indentedJoin = (values: string, indent: Indent): string => {
    if (values.length === 0) {
        return "";
    }

    const lineJoiner = indent.prev + indent.base;

    return lineJoiner + values.split(", ").join(`,${lineJoiner}`) + indent.prev;
};
