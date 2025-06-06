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

    if (array[Symbol.toStringTag]) {
        return array[Symbol.toStringTag];
    }

    return array.constructor.name;
};

const inspectTypedArray: InspectType<TypedArray> = (array: TypedArray, options: Options, inspect: InternalInspect): string => {
    const name = getArrayName(array);

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= name.length + 4;

    // Object.keys will always output the Array indices first, so we can slice by
    // `array.length` to get non-index properties
    const nonIndexProperties = Object.keys(array).slice(array.length);

    if (array.length === 0 && nonIndexProperties.length === 0) {
        return `${name}[]`;
    }

    // As we know TypedArrays only contain Unsigned Integers, we can skip inspecting each one and simply
    // stylise the toString() value of them
    let output = "";

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < array.length; index++) {
        const string = `${options.stylize(truncate(array[index] as number, options.maxStringLength), "number")}${index === array.length - 1 ? "" : ", "}`;

        // eslint-disable-next-line no-param-reassign
        options.maxStringLength -= string.length;

        if (array[index] !== array.length && options.maxStringLength <= 3) {
            output += `${TRUNCATOR}(${array.length - (array[index] as number) + 1})`;
            break;
        }

        output += string;
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
