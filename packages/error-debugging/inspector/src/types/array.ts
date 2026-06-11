import { INDENT_SEPARATOR } from "../constants";
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

// Collect own enumerable string keys that are NOT array indices. A reverse scan
// avoids `Object.keys(array).slice(array.length)`, which materializes the full
// list of N index strings only to throw them away — wasteful for large arrays.
const getNonIndexProperties = (array: unknown[]): string[] => {
    const nonIndex: string[] = [];

    for (const key in array) {
        // eslint-disable-next-line no-restricted-syntax
        if (!Object.hasOwn(array, key)) {
            continue;
        }

        // A canonical array index is a non-negative integer < 2^32 - 1 whose string
        // form round-trips. Anything else (e.g. "foo", "-1", "1.5") is a real prop.
        const asNumber = Number(key);

        if (Number.isInteger(asNumber) && asNumber >= 0 && String(asNumber) === key && asNumber < 0xff_ff_ff_ff) {
            continue;
        }

        nonIndex.push(key);
    }

    return nonIndex;
};

const inspectArray: InspectType<unknown[]> = (array: unknown[], options: Options, inspect: InternalInspect, indent: Indent | undefined): string => {
    const nonIndexProperties = getNonIndexProperties(array);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return "[]";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    const hasIndent = Boolean(indent) && multiLineValues(array);

    let listContents = inspectList(array, array, options, inspect, undefined, hasIndent ? INDENT_SEPARATOR : ", ", options.maxArrayLength);

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

    if (hasIndent && indent) {
        listContents = indentedJoin(listContents, indent);
    }

    return `[${hasIndent ? "" : " "}${listContents}${propertyContents ? `, ${propertyContents}` : ""}${hasIndent ? "" : " "}]`;
};

export default inspectArray;
