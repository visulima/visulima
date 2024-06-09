import type { Inspect, Options } from "../types";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";
import truncate from "../utils/truncate";

const errorKeys = new Set(["stack", "line", "column", "name", "message", "fileName", "lineNumber", "columnNumber", "number", "description"]);

const inspectObject = (error: Error, options: Options): string => {
    const properties = Object.getOwnPropertyNames(error).filter((key) => !errorKeys.has(key));
    const { name } = error;

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length;

    let message = "";

    if (typeof error.message === "string") {
        message = truncate(error.message, options.truncate);
    } else {
        properties.unshift("message");
    }

    message = message ? `: ${message}` : "";

    // eslint-disable-next-line no-param-reassign
    options.truncate -= message.length + 5;

    const propertyContents = inspectList(
        properties.map((key) => [key, error[key as keyof typeof error]]),
        options,
        inspectProperty as Inspect,
    );

    return `${name}${message}${propertyContents ? ` { ${propertyContents} }` : ""}`;
}

export default inspectObject;
