import type { Inspect, InspectType, Options } from "../types";

const quoteComplexKey = (key: string, options: Options): string => {
    if (/^[a-z_]\w*$/i.test(key)) {
        return key;
    }

    const stringifiedKey = JSON.stringify(key);

    if (options.quoteStyle === "double") {
        return stringifiedKey.replaceAll('"', '\\"');
    }

    return stringifiedKey
        .replaceAll("'", "\\'")
        .replaceAll('\\"', '"')
        .replaceAll(/^"|"$/g, "'");
}

const inspectProperty: InspectType<[unknown, unknown]> = ([key, value]: [unknown, unknown], options: Options, inspect: Inspect): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 2;

    if (typeof key === "string") {
        // eslint-disable-next-line no-param-reassign
        key = quoteComplexKey(key, options);
    } else if (typeof key !== "number") {
        // eslint-disable-next-line no-param-reassign
        key = `[${inspect(key, options)}]`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= (key as string).length;

    // eslint-disable-next-line no-param-reassign
    value = inspect(value, options);

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${key}: ${value}`;
};

export default inspectProperty;
