import { normaliseOptions } from "./helpers";
import inspectHTMLElement, { inspectHTMLCollection } from "./html";
import type { Inspect, Options } from "./types";
import inspectArguments from "./types/arguments";
import inspectArray from "./types/array";
import inspectBigInt from "./types/bigint";
import inspectClass from "./types/class";
import inspectDate from "./types/date";
import inspectError from "./types/error";
import inspectFunction from "./types/function";
import inspectMap from "./types/map";
import inspectNumber from "./types/number";
import inspectObject from "./types/object";
import inspectPromise from "./types/promise";
import inspectRegExp from "./types/regexp";
import inspectSet from "./types/set";
import inspectString from "./types/string";
import inspectSymbol from "./types/symbol";
import inspectTypedArray from "./types/typed-array";

let nodeInspect: symbol | false = false;
try {
    const nodeUtil = require("node:util");
    nodeInspect = nodeUtil.inspect ? nodeUtil.inspect.custom : false;
} catch {
    nodeInspect = false;
}

// eslint-disable-next-line @typescript-eslint/ban-types
const constructorMap = new WeakMap<Function, Inspect>();
const stringTagMap: Record<string, Inspect> = {};
const baseTypesMap = {
    Arguments: inspectArguments,
    Array: inspectArray,

    ArrayBuffer: () => "",
    BigInt: inspectBigInt,

    Boolean: (value: boolean, options: Options) => options.stylize(String(value), "boolean"),
    DataView: () => "",

    Date: inspectDate,
    Error: inspectError,

    Float32Array: inspectTypedArray,
    Float64Array: inspectTypedArray,

    Function: inspectFunction,
    Generator: () => "",

    HTMLCollection: inspectHTMLCollection,
    Int8Array: inspectTypedArray,

    Int16Array: inspectTypedArray,
    Int32Array: inspectTypedArray,
    Map: inspectMap,
    NodeList: inspectHTMLCollection,
    Number: inspectNumber,
    Promise: inspectPromise,

    RegExp: inspectRegExp,
    Set: inspectSet,

    String: inspectString,
    // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
    Symbol: inspectSymbol,
    Uint8Array: inspectTypedArray,
    Uint8ClampedArray: inspectTypedArray,
    Uint16Array: inspectTypedArray,
    Uint32Array: inspectTypedArray,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakMap: (_value: WeakMap<any, unknown>, options: Options) => options.stylize("WeakMap{…}", "special"),
    // WeakSet, WeakMap are totally opaque to us
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakSet: (_value: WeakSet<any>, options: Options) => options.stylize("WeakSet{…}", "special"),
    bigint: inspectBigInt,
    boolean: (value: boolean, options: Options) => options.stylize(String(value), "boolean"),

    function: inspectFunction,
    null: (_value: null, options: Options) => options.stylize("null", "null"),
    number: inspectNumber,

    string: inspectString,

    symbol: inspectSymbol,
    undefined: (_value: undefined, options: Options) => options.stylize("undefined", "undefined"),
} as const;

const inspectCustom = (value: object, options: Options, type: string): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (nodeInspect && nodeInspect in value && typeof (value as any)[nodeInspect] === "function") {
        // eslint-disable-next-line @typescript-eslint/ban-types,@typescript-eslint/no-explicit-any
        return ((value as any)[nodeInspect] as Function)(options.depth, options);
    }

    if ("inspect" in value && typeof value.inspect === "function") {
        return value.inspect(options.depth, options);
    }

    if ("constructor" in value && constructorMap.has(value.constructor)) {
        return constructorMap.get(value.constructor)!(value, options);
    }

    // eslint-disable-next-line security/detect-object-injection
    if (stringTagMap[type]) {
        // eslint-disable-next-line security/detect-object-injection
        return (stringTagMap[type] as Inspect)(value, options);
    }

    return "";
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const inspect = (value: unknown, options_: Partial<Options> = {}): string => {
    const options = normaliseOptions(options_, inspect);
    const { customInspect } = options;

    let type = value === null ? "null" : typeof value;

    if (type === "object") {
        type = Object.prototype.toString.call(value).slice(8, -1);
    }

    // If it is a base value that we already support, then use Loupe's inspector
    if (type in baseTypesMap) {
        return (baseTypesMap[type as keyof typeof baseTypesMap] as Inspect)(value, options);
    }

    // If `options.customInspect` is set to true then try to use the custom inspector
    if (customInspect && value) {
        const output = inspectCustom(value, options, type);

        if (output) {
            if (typeof output === "string") {
                return output;
            }

            return inspect(output, options);
        }
    }

    const proto = value ? Object.getPrototypeOf(value) : false;
    // If it's a plain Object then use Loupe's inspector
    if (proto === Object.prototype || proto === null) {
        return inspectObject(value as object, options);
    }

    // Specifically account for HTMLElements
    if (value && typeof HTMLElement === "function" && value instanceof HTMLElement) {
        return inspectHTMLElement(value, options);
    }

    if ("constructor" in (value as object)) {
        // If it is a class, inspect it like an object but add the constructor name
        if ((value as object).constructor !== Object) {
            return inspectClass(value as new (...arguments_: any[]) => unknown, options);
        }

        // If it is an object with an anonymous prototype, display it as an object.
        return inspectObject(value as object, options);
    }

    // last chance to check if it's an object
    if (value === Object(value)) {
        return inspectObject(value as object, options);
    }

    // We have run out of options! Just stringify the value
    return (options as Options).stylize(String(value), type);
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const registerConstructor = (constructor: Function, inspector: Inspect): boolean => {
    if (constructorMap.has(constructor)) {
        return false;
    }

    constructorMap.set(constructor, inspector);

    return true;
};

export const registerStringTag = (stringTag: string, inspector: Inspect): boolean => {
    if (stringTag in stringTagMap) {
        return false;
    }

    // eslint-disable-next-line security/detect-object-injection
    stringTagMap[stringTag] = inspector;

    return true;
};
