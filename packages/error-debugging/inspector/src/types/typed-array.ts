import { TRUNCATOR } from "../constants";
import type { InspectType, InternalInspect, Options } from "../types";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";
import truncate from "../utils/truncate";

type TypedArray = Float32Array | Float64Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array;

const getArrayName = (array: TypedArray) => {
    // We need to special case Node.js' Buffers, which report to be Uint8Array
    if (typeof Buffer === "function" && array instanceof Buffer) {
        return "Buffer";
    }

    return array[Symbol.toStringTag];
};

const inspectTypedArray: InspectType<TypedArray> = (array: TypedArray, options: Options, inspect: InternalInspect): string => {
    const name = getArrayName(array);

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length + 4;

    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return `${name}[]`;
    }

    // As we know TypedArrays only contain Unsigned Integers, we can skip inspecting each one and simply
    // stylise the toString() value of them
    let output = "";

    // Cap the number of rendered elements at `maxArrayLength` (mirrors util.inspect).
    const limit = Number.isFinite(options.maxArrayLength) ? Math.min(array.length, Math.max(0, Math.floor(options.maxArrayLength))) : array.length;

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < limit; index++) {
        const string = `${options.stylize(truncate(array[index] as number, options.truncate), "number")}${index === limit - 1 ? "" : ", "}`;

        // eslint-disable-next-line no-param-reassign
        options.truncate -= string.length;

        if (index !== limit - 1 && options.truncate <= 3) {
            output += `${TRUNCATOR}(${String(array.length - index)})`;
            break;
        }

        output += string;
    }

    if (limit < array.length) {
        output += `${output ? ", " : ""}${TRUNCATOR} ${String(array.length - limit)} more`;
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

    return `${name}[ ${output}${propertyContents ? `, ${propertyContents}` : ""} ]`;
};

export default inspectTypedArray;
