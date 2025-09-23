import { inspectHTMLElement, inspectNodeCollection } from "./html";
import type { Inspect, InspectType, InternalInspect, InternalOptions } from "./types";
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
import { getIndent } from "./utils/indent";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const constructorMap = new WeakMap<Function, Inspect>();
const stringTagMap: Record<string, Inspect> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseTypesMap: Record<string, InspectType<any>> = {
    Arguments: inspectArguments,
    Array: inspectArray,

    ArrayBuffer: () => "",
    BigInt: inspectBigInt,

    bigint: inspectBigInt,
    Boolean: (value: boolean, options: InternalOptions) => options.stylize(String(value), "boolean"),
    boolean: (value: boolean, options: InternalOptions) => options.stylize(String(value), "boolean"),

    DataView: () => "",

    Date: inspectDate,
    Error: inspectError,

    Float32Array: inspectTypedArray,
    Float64Array: inspectTypedArray,

    Function: inspectFunction,
    function: inspectFunction,

    Generator: () => "",
    HTMLCollection: inspectNodeCollection,
    Int8Array: inspectTypedArray,
    Int16Array: inspectTypedArray,
    Int32Array: inspectTypedArray,
    Map: inspectMap,

    NodeList: inspectNodeCollection,
    null: (_value: null, options: InternalOptions) => options.stylize("null", "null"),

    Number: inspectNumber,
    number: inspectNumber,
    Promise: inspectPromise,
    RegExp: inspectRegExp,
    Set: inspectSet,
    String: inspectString,
    string: inspectString,
    // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
    Symbol: inspectSymbol,
    symbol: inspectSymbol,
    Uint8Array: inspectTypedArray,

    Uint8ClampedArray: inspectTypedArray,
    Uint16Array: inspectTypedArray,
    Uint32Array: inspectTypedArray,

    undefined: (_value: undefined, options: InternalOptions) => options.stylize("undefined", "undefined"),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakMap: (_value: WeakMap<any, unknown>, options: InternalOptions) => options.stylize("WeakMap{…}", "special"),
    // WeakSet, WeakMap are totally opaque to us
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakSet: (_value: WeakSet<any>, options: InternalOptions) => options.stylize("WeakSet{…}", "special"),
} as const;

const inspectCustom = (value: object, options: InternalOptions, type: string, inspectFunction_: InternalInspect): string | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (globalThis.window === undefined && typeof (value as any)[Symbol.for("nodejs.util.inspect.custom")] === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type
        return ((value as any)[Symbol.for("nodejs.util.inspect.custom")] as Function)(options.depth, options, inspectFunction_);
    }

    if ("inspect" in value && typeof value.inspect === "function") {
        return value.inspect(options.depth, options);
    }

    if ("constructor" in value && constructorMap.has(value.constructor)) {
        return constructorMap.get(value.constructor)?.(value, options) ?? "unknown";
    }

    if (stringTagMap[type]) {
        return (stringTagMap[type] as Inspect)(value, options);
    }

    return "";
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export const internalInspect = (value: unknown, options: InternalOptions, depth: number, seen: unknown[]): string => {
    if (seen.includes(value)) {
        return "[Circular]";
    }

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const inspect: InternalInspect = (object: unknown, from: unknown, options: InternalOptions): string => {
        if (from) {
            // eslint-disable-next-line no-param-reassign
            seen = [...seen];
            seen.push(from);
        }

        return internalInspect(object, options, depth + 1, seen);
    };

    const indent = options.indent ? getIndent(options.indent, depth) : undefined;

    const multiline = value && (typeof value === "object" || Array.isArray(value));

    if (options.depth !== undefined && depth >= options.depth && options.depth > 0 && multiline) {
        return Array.isArray(value) ? "[Array]" : "[Object]";
    }

    let type = value === null ? "null" : typeof value;

    if (type === "object") {
        type = Object.prototype.toString.call(value).slice(8, -1);
    }

    if (options.showProxy && options.proxyHandler) {
        return options.proxyHandler(value as typeof Proxy, options, inspect, indent, depth);
    }

    // If it is a base value that we already support, then use inspector
    if (baseTypesMap[type as keyof typeof baseTypesMap] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (baseTypesMap[type as keyof typeof baseTypesMap] as InspectType<any>)(value, options, inspect, indent, depth);
    }

    // If `options.customInspect` is set to true then try to use the custom inspector
    if (options.customInspect && value) {
        // eslint-disable-next-line no-param-reassign
        options.depth = options.depth === undefined ? Number.POSITIVE_INFINITY : options.depth - depth;

        const output = inspectCustom(value, options, type, inspect);

        if (output) {
            if (typeof output === "string") {
                return output;
            }

            return inspect(output, value, options);
        }
    }

    const proto = value ? Object.getPrototypeOf(value) : false;

    // If it's a plain Object then use inspector
    if (proto === Object.prototype || proto === null) {
        return inspectObject(value as object, options, inspect, indent, depth);
    }

    // Specifically account for HTMLElements
    if (value && typeof HTMLElement === "function" && value instanceof HTMLElement) {
        return inspectHTMLElement(value, value, options, inspect, depth);
    }

    if ("constructor" in (value as object)) {
        // If it is a class, inspect it like an object but add the constructor name
        if ((value as object).constructor !== Object) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return inspectClass(value as new (...arguments_: any[]) => unknown, options, inspect, indent, depth);
        }

        // If it is an object with an anonymous prototype, display it as an object.
        return inspectObject(value as object, options, inspect, indent, depth);
    }

    // last chance to check if it's an object
    if (value === Object(value)) {
        return inspectObject(value as object, options, inspect, indent, depth);
    }

    // We have run out of options! Just stringify the value
    return (options as InternalOptions).stylize(String(value), type);
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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

    stringTagMap[stringTag] = inspector;

    return true;
};
