import { inspectList, inspectProperty } from "../helpers";
import type { Inspect, Options } from "../types";

export default function inspectObject(object: object, options: Options): string {
    const properties = Object.getOwnPropertyNames(object);
    const symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];
    if (properties.length === 0 && symbols.length === 0) {
        return "{}";
    }
    options.truncate -= 4;
    options.seen = options.seen || [];
    if (options.seen.includes(object)) {
        return "[Circular]";
    }
    options.seen.push(object);
    const propertyContents = inspectList(
        properties.map((key) => [key, object[key as keyof typeof object]]),
        options,
        inspectProperty as Inspect,
    );
    const symbolContents = inspectList(
        symbols.map((key) => [key, object[key as keyof typeof object]]),
        options,
        inspectProperty as Inspect,
    );
    options.seen.pop();
    let separator = "";
    if (propertyContents && symbolContents) {
        separator = ", ";
    }
    return `{ ${propertyContents}${separator}${symbolContents} }`;
}
