import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";
import truncate from "../utils/truncate";

type TypedArray = Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array;

const getArrayName = (array: TypedArray): string => {
    // We need to special case Node.js's Buffer, which is a Uint8Array
    if (typeof Buffer === "function" && array instanceof Buffer) {
        return "Buffer";
    }

    if (array[Symbol.toStringTag]) {
        return array[Symbol.toStringTag];
    }

    return array.constructor.name;
};

// This custom inspector can handle both numbers and property pairs
const inspectTypedArrayItem = (item: [unknown, unknown], object: unknown, options: Options, inspect: InternalInspect): string => {
    if (Array.isArray(item)) {
        // It's a property `[key, value]`
        return inspectProperty(item, object, options, inspect);
    }

    // It's a number from the typed array
    const stringified = String(item);
    const truncated = truncate(stringified, options.maxStringLength ?? Number.POSITIVE_INFINITY);

    return options.stylize(truncated, "number");
};

const inspectTypedArray: InspectType<TypedArray> = (array: TypedArray, options: Options, inspect: InternalInspect, indent, depth): string => {
    const name = getArrayName(array);
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return `${name}[]`;
    }

    const allItems = [...array, ...nonIndexProperties.map((key) => [key, array[key as keyof typeof array]])];

    let breakLines: boolean = false;

    if (options.breakLength) {
        const temporaryOptions = { ...options, compact: false, maxStringLength: Number.POSITIVE_INFINITY };
        const contentsForCheck = inspectList(allItems, array, temporaryOptions, inspect, inspectTypedArrayItem);
        const singleLineOutput = `${name}[ ${contentsForCheck} ]`;

        breakLines = singleLineOutput.length > options.breakLength;
    }

    const multiline = (options.compact === false || (typeof options.compact === "number" && depth >= options.compact) || breakLines) && indent !== undefined;

    let newOptions = options;

    if (options.maxStringLength !== null) {
        newOptions = {
            ...options,
            maxStringLength: options.maxStringLength - name.length - 4, // account for "[]" and spaces
        };
    }

    let returnValue = inspectList(allItems, array, newOptions, inspect, inspectTypedArrayItem);

    if (multiline) {
        returnValue = indentedJoin(returnValue, indent as Indent);
    }

    return `${name}[ ${returnValue} ]`;
};

export default inspectTypedArray;
