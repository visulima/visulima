import type { Inspect, InspectType, Options } from "../types";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

const inspectArray: InspectType<ArrayLike<unknown>> = (array: ArrayLike<unknown>, options: Options, inspect: Inspect): string => {
    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return "[]";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    const listContents = inspectList(array, options, inspect);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= listContents.length;

    let propertyContents = "";

    if (nonIndexProperties.length > 0) {
        propertyContents = inspectList(
            nonIndexProperties.map((key) => [key, array[key as keyof typeof array]]),
            options,
            inspect,
            inspectProperty,
        );
    }

    return `[ ${listContents}${propertyContents ? `, ${propertyContents}` : ""} ]`;
}

export default inspectArray;
