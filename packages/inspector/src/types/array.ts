import { inspectList, inspectProperty } from "../helpers";
import type { Inspect, Options } from "../types";

const inspectArray = (array: ArrayLike<unknown>, options: Options): string => {
    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return "[]";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    const listContents = inspectList(array, options);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= listContents.length;

    let propertyContents = "";

    if (nonIndexProperties.length > 0) {
        propertyContents = inspectList(
            nonIndexProperties.map((key) => [key, array[key as keyof typeof array]]),
            options,
            inspectProperty as Inspect,
        );
    }

    return `[ ${listContents}${propertyContents ? `, ${propertyContents}` : ""} ]`;
}

export default inspectArray;
