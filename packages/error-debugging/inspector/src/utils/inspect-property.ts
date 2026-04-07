import type { InternalInspect, Options } from "../types";

const simpleKeyRegex = /^[a-z_]\w*$/i;
const quoteEdgesRegex = /^"|"$/g;

const quoteComplexKey = (key: string, options: Options): string => {
    if (simpleKeyRegex.test(key)) {
        return key;
    }

    const stringifiedKey = JSON.stringify(key);

    if (options.quoteStyle === "double") {
        return stringifiedKey.replaceAll("\"", String.raw`\"`);
    }

    return stringifiedKey.replaceAll("'", String.raw`\'`).replaceAll(String.raw`\"`, "\"").replaceAll(quoteEdgesRegex, "'");
};

const inspectProperty = ([key, value]: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 2;

    let keyString: string;

    if (typeof key === "string") {
        keyString = quoteComplexKey(key, options);
    } else if (typeof key === "number") {
        keyString = String(key);
    } else {
        keyString = `[${inspect(key, object, options)}]`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= keyString.length;

    const valueString = inspect(value, object, options);

    return `${keyString}: ${valueString}`;
};

export default inspectProperty;
