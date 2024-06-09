import type { Options } from "../types";

const quoteComplexKey = (key: string): string => {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }

    return JSON.stringify(key)
        .replaceAll("'", "\\'")
        .replaceAll('\\"', '"')
        .replaceAll(/^"|"$/g, "'");
}

const inspectProperty = ([key, value]: [unknown, unknown], options: Options): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 2;

    if (typeof key === "string") {
        // eslint-disable-next-line no-param-reassign
        key = quoteComplexKey(key);
    } else if (typeof key !== "number") {
        // eslint-disable-next-line no-param-reassign
        key = `[${options.inspect(key, options)}]`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    // eslint-disable-next-line no-param-reassign
    value = options.inspect(value, options);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${key}: ${value}`;
};

export default inspectProperty;
