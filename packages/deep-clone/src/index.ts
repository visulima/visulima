import { copyArrayLoose, copyArrayStrict } from "./handler/copy-array";
import copyArrayBuffer from "./handler/copy-array-buffer";
import copyBlob from "./handler/copy-blob";
import copyDataView from "./handler/copy-data-view";
import copyDate from "./handler/copy-date";
import copyError from "./handler/copy-error";
import { copyMapLoose, copyMapStrict } from "./handler/copy-map";
import { copyObjectLoose, copyObjectStrict } from "./handler/copy-object";
import { copyRegExpLoose, copyRegExpStrict } from "./handler/copy-regexp";
import { copySetLoose, copySetStrict } from "./handler/copy-set";
import type { Options, State } from "./types";

// eslint-disable-next-line @typescript-eslint/ban-types
const canValueHaveProperties = (value: unknown): value is NonNullable<Function | object> =>
    (typeof value === "object" && value !== null) || typeof value === "function";

/**
 * handler mappings for different data types.
 */
const handlers = {
    Array: copyArrayLoose,
    ArrayBuffer: copyArrayBuffer,
    Blob: copyBlob,
    DataView: copyDataView,
    Date: copyDate,
    Error: copyError,
    // eslint-disable-next-line @typescript-eslint/ban-types,@typescript-eslint/no-unused-vars
    Function: (object: Function, _state: State) => object,
    Map: copyMapLoose,
    Object: copyObjectLoose,
    Promise: (object: Promise<unknown>) => {
        throw new TypeError(`${object.constructor.name} objects cannot be cloned`);
    },
    RegExp: copyRegExpLoose,
    Set: copySetLoose,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    SharedArrayBuffer: (object: SharedArrayBuffer, _state: State) => {
        throw new TypeError(`${object.constructor.name} objects cannot be cloned`);
    },
    WeakMap: (object: WeakMap<any, any>) => {
        throw new TypeError(`${object.constructor.name} objects cannot be cloned`);
    },
    WeakSet: (object: WeakSet<any>) => {
        throw new TypeError(`${object.constructor.name} objects cannot be cloned`);
    },
};

type DeepReadwrite<T> = T extends object | [] ? { -readonly [P in keyof T]: DeepReadwrite<T[P]> } : T;

interface FakeJSDOM {
    cloneNode?: (check: boolean) => unknown;
    nodeType?: unknown;
}

/**
 * Function that creates a deep clone of an object or array.
 *
 * @template T - The type of the original data.
 * @param originalData - The original data to be cloned. It uses the generic parameter `T`.
 * @param options - Optional. The cloning options. Type of this parameter is `Options`.
 * @returns The deep cloned data with its type as `DeepReadwrite<T>`.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const deepClone = <T>(originalData: T, options?: Options): DeepReadwrite<T> => {
    if (!canValueHaveProperties(originalData)) {
        return originalData as DeepReadwrite<T>;
    }

    const cloner = {
        ...handlers,
        ...(options?.strict ? { Array: copyArrayStrict, Map: copyMapStrict, Object: copyObjectStrict, RegExp: copyRegExpStrict, Set: copySetStrict } : {}),
        ...options?.handler,
    };

    let cache: WeakMap<any, any> | null = new WeakMap();

    const clone = (value: any, state: State): any => {
        if (!canValueHaveProperties(value)) {
            return value as DeepReadwrite<T>;
        }

        if (state.cache.has(value)) {
            return state.cache.get(value);
        }

        if (Array.isArray(value)) {
            return cloner.Array(value, state);
        }

        if (typeof value === "object" && value.constructor === Object && (value as FakeJSDOM).nodeType === undefined) {
            return cloner.Object(value as Record<PropertyKey, unknown>, state);
        }

        if ((value as FakeJSDOM).nodeType !== undefined && (value as FakeJSDOM).cloneNode !== undefined) {
            return (value as { cloneNode: (check: boolean) => unknown }).cloneNode(true);
        }

        if (value instanceof Date) {
            return cloner.Date(value, state);
        }

        if (value instanceof RegExp) {
            return cloner.RegExp(value, state);
        }

        if (value instanceof Map) {
            return cloner.Map(value, state);
        }

        if (value instanceof Set) {
            return cloner.Set(value, state);
        }

        if (value instanceof Error) {
            return cloner.Error(value, state);
        }

        if (
            value instanceof ArrayBuffer ||
            value instanceof Uint8Array ||
            value instanceof Uint8ClampedArray ||
            value instanceof Int8Array ||
            value instanceof Uint16Array ||
            value instanceof Int16Array ||
            value instanceof Uint32Array ||
            value instanceof Int32Array ||
            value instanceof Float32Array ||
            value instanceof Float64Array
        ) {
            return cloner.ArrayBuffer(value, state);
        }

        if (value instanceof Blob) {
            return cloner.Blob(value, state);
        }

        if (value instanceof DataView) {
            return cloner.DataView(value, state);
        }

        if (value instanceof SharedArrayBuffer) {
            return cloner.SharedArrayBuffer(value, state);
        }

        if (value instanceof Promise) {
            return cloner.Promise(value, state);
        }

        if (value instanceof WeakMap) {
            return cloner.WeakMap(value, state);
        }

        if (value instanceof WeakSet) {
            return cloner.WeakSet(value, state);
        }

        if (value instanceof Function) {
            return cloner.Function(value, state);
        }

        if (typeof value === "object") {
            return cloner.Object(value as Record<PropertyKey, unknown>, state);
        }

        throw new TypeError(`Type of ${typeof value} cannot be cloned`, value);
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cloned = clone(originalData, { cache, clone });

    // Reset the cache to free up memory
    cache = null;

    return cloned as DeepReadwrite<T>;
};

// eslint-disable-next-line import/no-unused-modules
export type { Options, State } from "./types";
