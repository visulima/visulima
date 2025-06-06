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

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectArray: InspectType<unknown[]> = (array: unknown[], options: Options, inspect: InternalInspect, indent: Indent | undefined, depth: number): string => {
    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (options.sorted) {
        nonIndexProperties.sort(typeof options.sorted === "function" ? options.sorted : undefined);
    }

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return "[]";
    }

    const temporaryOptions = { ...options, maxStringLength: Number.POSITIVE_INFINITY };
    const listContentsForCheck = inspectList(array, array, temporaryOptions, inspect);
    let propertyContentsForCheck = "";

    if (nonIndexProperties.length > 0) {
        propertyContentsForCheck = inspectList(
            nonIndexProperties.map((key) => [key, array[key as keyof typeof array]]),
            array,
            temporaryOptions,
            inspect,
            inspectProperty,
        );
    }

    const separatorForCheck = listContentsForCheck && propertyContentsForCheck ? ", " : "";
    const singleLineOutput = `[ ${listContentsForCheck}${separatorForCheck}${propertyContentsForCheck} ]`;

    const multiline
        = (options.compact === false
            || (typeof options.compact === "number" && depth >= options.compact)
            || singleLineOutput.length > options.breakLength
            || multiLineValues(array))
        && indent !== undefined;

    if (options.maxStringLength !== null) {
        // eslint-disable-next-line no-param-reassign
        options.maxStringLength -= 4;
    }

    const listContents = inspectList(array, array, options, inspect);

    if (options.maxStringLength !== null) {
        // eslint-disable-next-line no-param-reassign
        options.maxStringLength -= listContents.length;
    }

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

    const separator = listContents && propertyContents ? ", " : "";

    if (multiline) {
        const joined = indentedJoin(listContents + separator + propertyContents, indent as Indent);

        return `[${joined}]`;
    }

    return `[ ${listContents}${separator}${propertyContents} ]`;
};

export default inspectArray;
