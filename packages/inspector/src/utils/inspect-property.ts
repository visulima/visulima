import type { InternalInspect, Options } from "../types";

const quoteComplexKey = (key: string, options: Options): string => {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }

    const stringifiedKey = JSON.stringify(key);

    if (options.quoteStyle === "double") {
        return stringifiedKey.replaceAll("\"", String.raw`\"`);
    }

    return stringifiedKey
        .replaceAll("'", String.raw`\'`)
        .replaceAll(String.raw`\"`, "\"")
        .replaceAll(/^"|"$/g, "'");
};

const inspectProperty = ([key, value]: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 2;

    if (typeof key === "string") {
        // eslint-disable-next-line no-param-reassign
        key = quoteComplexKey(key, options);
    } else if (typeof key !== "number") {
        // eslint-disable-next-line no-param-reassign
        key = `[${inspect(key, object, options)}]`;
    }

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= String(key).length;

    // eslint-disable-next-line no-param-reassign
    value = inspect(value, object, options);

    return `${key}: ${value}`;
};

export default inspectProperty;
