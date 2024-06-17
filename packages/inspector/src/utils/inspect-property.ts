import type { InternalInspect, Options } from "../types";

const quoteComplexKey = (key: string, options: Options): string => {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }

    const stringifiedKey = JSON.stringify(key);

    if (options.quoteStyle === "double") {
        return stringifiedKey.replaceAll('"', '\\"');
    }

    return stringifiedKey.replaceAll("'", "\\'").replaceAll('\\"', '"').replaceAll(/^"|"$/g, "'");
};

const inspectProperty = ([key, value]: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 2;

    if (typeof key === "string") {
        // eslint-disable-next-line no-param-reassign
        key = quoteComplexKey(key, options);
    } else if (typeof key !== "number") {
        // eslint-disable-next-line no-param-reassign
        key = `[${inspect(key, object, options)}]`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    // eslint-disable-next-line no-param-reassign
    value = inspect(value, object, options);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${key}: ${value}`;
};

export default inspectProperty;
