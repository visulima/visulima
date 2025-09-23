import type { InspectType, InternalInspect, Options } from "../types";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";
import truncate from "../utils/truncate";

const errorKeys = new Set(["column", "columnNumber", "description", "fileName", "line", "lineNumber", "message", "name", "number", "stack"]);

const inspectError: InspectType<Error> = (error: Error, options: Options, inspect: InternalInspect): string => {
    const properties = Object.getOwnPropertyNames(error).filter((key) => !errorKeys.has(key));
    const { name } = error;

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= name.length;

    let message = "";

    if (typeof error.message === "string") {
        message = truncate(error.message, options.maxStringLength ?? Number.POSITIVE_INFINITY);
    } else {
        properties.unshift("message");
    }

    message = message ? `: ${message}` : "";

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= message.length + 5;

    const propertyContents = inspectList(
        properties.map((key) => [key, error[key as keyof typeof error]]),
        error,
        options,
        inspect,
        inspectProperty,
    );

    return `${name}${message}${propertyContents ? ` { ${propertyContents} }` : ""}`;
};

export default inspectError;
