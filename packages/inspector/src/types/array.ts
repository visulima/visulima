import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

const multiLineValues = (values: unknown[]): boolean => {
    for (const value of values) {
        if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
            return true;
        }
    }

    return false;
};

const inspectArray: InspectType<unknown[]> = (array: unknown[], options: Options, inspect: InternalInspect, indent: Indent | undefined): string => {
    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return "[]";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    let listContents = inspectList(array, array, options, inspect);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= listContents.length;

    let propertyContents = "";

    if (nonIndexProperties.length > 0) {
        propertyContents = inspectList(
            nonIndexProperties.map((key) => [key, array[key as keyof typeof array]]),
            array,
            options,
            inspect,
            inspectProperty,
        );
    }

    const hasIndent = indent && multiLineValues(array);

    if (hasIndent) {
        listContents = indentedJoin(listContents, indent);
    }

    return `[${hasIndent ? "" : " "}${listContents}${propertyContents ? `, ${propertyContents}` : ""}${hasIndent ? "" : " "}]`;
};

export default inspectArray;
