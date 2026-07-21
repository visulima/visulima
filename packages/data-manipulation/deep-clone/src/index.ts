import { copyArrayLoose, copyArrayStrict } from "./handler/copy-array";
import copyArrayBuffer from "./handler/copy-array-buffer";
import copyBlob from "./handler/copy-blob";
import copyDataView from "./handler/copy-data-view";
import copyDate from "./handler/copy-date";
import copyError from "./handler/copy-error";
import copyFile from "./handler/copy-file";
import { copyMapLoose, copyMapStrict } from "./handler/copy-map";
import { copyObjectLoose, copyObjectStrict } from "./handler/copy-object";
import { copyRegExpLoose, copyRegExpStrict } from "./handler/copy-regexp";
import { copySetLoose, copySetStrict } from "./handler/copy-set";
import type { Handlers, Options, State } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const canValueHaveProperties = (value: unknown): value is NonNullable<Function | object> =>
    (typeof value === "object" && value !== null) || typeof value === "function";

const throwUncloneable = (object: { constructor: { name: string } }): never => {
    throw new TypeError(`${object.constructor.name} objects cannot be cloned`);
};

/**
 * Default (loose) handler table for the supported data types. Hoisted to module
 * scope and frozen so that the common no-options call path does not allocate a new
 * table on every `deepClone()` invocation.
 */
const looseHandlers: Handlers = {
    Array: copyArrayLoose,
    ArrayBuffer: copyArrayBuffer,
    Blob: copyBlob,
    DataView: copyDataView,
    Date: copyDate,
    Error: copyError,
    File: copyFile,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    Function: (object: Function, _state: State) => object,
    Map: copyMapLoose,
    Object: copyObjectLoose,
    Promise: throwUncloneable,
    RegExp: copyRegExpLoose,
    Set: copySetLoose,
    SharedArrayBuffer: throwUncloneable,
    WeakMap: throwUncloneable,
    WeakSet: throwUncloneable,
};

/**
 * Default strict handler table. Reuses the loose handlers for every type whose
 * strict behaviour is identical and overrides only the collection/array/object/
 * regexp copiers that differ in strict mode.
 */
const strictHandlers: Handlers = {
    ...looseHandlers,
    Array: copyArrayStrict,
    Map: copyMapStrict,
    Object: copyObjectStrict,
    RegExp: copyRegExpStrict,
    Set: copySetStrict,
};

/**
 * Deep-mutable mirror of `T`: recursively strips `readonly` modifiers so the
 * returned clone is fully writable. This is the return type of {@link deepClone}
 * and {@link createDeepClone}, exported (at the end of the file) because it
 * appears in their public signatures.
 * @template T - The type to make deeply writable.
 */
type DeepReadwrite<T> = T extends object | [] ? { -readonly [P in keyof T]: DeepReadwrite<T[P]> } : T;

interface FakeJSDOM {
    cloneNode?: (check: boolean) => unknown;
    nodeType?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalClone = (value: any, state: State) => any;

/**
 * Build the `clone` dispatcher for a resolved handler table. The returned function
 * is what `State.clone` points at, so every recursive call reuses the same handler
 * resolution (no per-recursion table lookup).
 */
const buildClone = (cloner: Handlers): InternalClone =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,sonarjs/cognitive-complexity
    function clone(value: any, state: State): any {
        if (!canValueHaveProperties(value)) {
            return value;
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
            const cloned = (value as { cloneNode: (check: boolean) => unknown }).cloneNode(true);

            state.cache.set(value, cloned);

            return cloned;
        }

        if (value instanceof Date) {
            const cloned = cloner.Date(value, state);

            // Cache leaf clones so duplicate references to the same Date collapse to a
            // single clone (matching the structured-clone identity semantics).
            state.cache.set(value, cloned);

            return cloned;
        }

        if (value instanceof RegExp) {
            const cloned = cloner.RegExp(value, state);

            state.cache.set(value, cloned);

            return cloned;
        }

        if (value instanceof Map) {
            return cloner.Map(value, state);
        }

        if (value instanceof Set) {
            return cloner.Set(value, state);
        }

        if (value instanceof Error) {
            // eslint-disable-next-line unicorn/throw-new-error
            return cloner.Error(value, state);
        }

        if (value instanceof ArrayBuffer) {
            const cloned = cloner.ArrayBuffer(value, state);

            state.cache.set(value, cloned);

            return cloned;
        }

        if (
            value instanceof Uint8Array
            || value instanceof Uint8ClampedArray
            || value instanceof Int8Array
            || value instanceof Uint16Array
            || value instanceof Int16Array
            || value instanceof Uint32Array
            || value instanceof Int32Array
            || value instanceof Float32Array
            || value instanceof Float64Array
            || value instanceof BigInt64Array
            || value instanceof BigUint64Array
        ) {
            const { buffer } = value;

            if (buffer instanceof SharedArrayBuffer) {
                throw new TypeError("SharedArrayBuffer cannot be cloned");
            }

            // Share a single clone of the underlying buffer across every view (and any
            // direct reference to the raw buffer) so writes through one cloned view are
            // visible to the others, matching structured-clone identity semantics.
            let clonedBuffer = state.cache.get(buffer) as ArrayBuffer | undefined;

            if (clonedBuffer === undefined) {
                clonedBuffer = cloner.ArrayBuffer(buffer, state);

                state.cache.set(buffer, clonedBuffer);
            }

            // Node `Buffer`s extend `Uint8Array`; reconstruct them via `Buffer.from`
            // instead of the deprecated `new Buffer()` constructor (DEP0005).
            if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
                const clonedNodeBuffer = Buffer.from(clonedBuffer, value.byteOffset, value.length);

                state.cache.set(value, clonedNodeBuffer);

                return clonedNodeBuffer;
            }

            const TypedArrayConstructor = value.constructor as new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => typeof value;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const cloned = new TypedArrayConstructor(clonedBuffer, value.byteOffset, value.length);

            state.cache.set(value, cloned);

            return cloned;
        }

        // `File` extends `Blob`, so it must be checked first to preserve `name` and
        // `lastModified` rather than degrading to a plain Blob.
        if (typeof File !== "undefined" && value instanceof File) {
            const cloned = cloner.File(value, state);

            state.cache.set(value, cloned);

            return cloned;
        }

        if (typeof Blob !== "undefined" && value instanceof Blob) {
            const cloned = cloner.Blob(value, state);

            state.cache.set(value, cloned);

            return cloned;
        }

        if (value instanceof DataView) {
            const cloned = cloner.DataView(value, state);

            state.cache.set(value, cloned);

            return cloned;
        }

        // Boxed primitives (`new Number(5)`, `new String("x")`, `Object(1n)`, ...) keep
        // their value in an internal slot that the generic object handler would drop
        // (leaving `0`/`false`/`""`). Re-box the primitive so `valueOf()` survives.
        const boxedTag = Object.prototype.toString.call(value);

        if (
            boxedTag === "[object Number]"
            || boxedTag === "[object String]"
            || boxedTag === "[object Boolean]"
            || boxedTag === "[object BigInt]"
            || boxedTag === "[object Symbol]"
        ) {
            const unboxed = (value as { valueOf: () => unknown }).valueOf();

            // A genuine boxed primitive unboxes to a primitive. A plain object that merely
            // spoofs `Symbol.toStringTag` inherits `Object.prototype.valueOf`, which returns
            // the object itself; `Object(value)` would then hand back the original reference
            // (a shared-mutation footgun). Only take the re-box path for real boxed primitives
            // and let spoofed objects fall through to the generic object handler.
            if (typeof unboxed !== "object" && typeof unboxed !== "function") {
                // Box the primitive via `Object(...)`; `new Object(...)`/`{}` cannot wrap a primitive value.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,unicorn/new-for-builtins
                const cloned = Object(unboxed);

                state.cache.set(value, cloned);

                return cloned;
            }
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

        if (typeof value === "function") {
            return cloner.Function(value, state);
        }

        if (typeof value === "object") {
            return cloner.Object(value as Record<PropertyKey, unknown>, state);
        }

        throw new TypeError(`Type of ${typeof value} cannot be cloned`);
    };

/**
 * Dispatchers for the two default handler tables, built once at module load so the
 * common no-custom-handler call path never rebuilds the ~140-line closure per call.
 */
const looseClone = buildClone(looseHandlers);
const strictClone = buildClone(strictHandlers);

/**
 * Resolve the `clone` dispatcher for the given options. The prebuilt loose/strict
 * dispatchers are reused as-is when no custom handlers are provided; a custom handler
 * table builds its dispatcher once here (or once per `createDeepClone`).
 */
const resolveClone = (options?: Options): InternalClone => {
    if (!options?.handler) {
        return options?.strict ? strictClone : looseClone;
    }

    const base = options.strict ? strictHandlers : looseHandlers;

    return buildClone({ ...base, ...options.handler });
};

const runClone = <T>(originalData: T, clone: InternalClone): DeepReadwrite<T> => {
    if (!canValueHaveProperties(originalData)) {
        return originalData as DeepReadwrite<T>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = new WeakMap<any>();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cloned = clone(originalData, { cache, clone });

    return cloned as DeepReadwrite<T>;
};

/**
 * Function that creates a deep clone of an object or array.
 * @template T - The type of the original data.
 * @param originalData The original data to be cloned. It uses the generic parameter `T`.
 * @param options Optional. The cloning options. Type of this parameter is `Options`.
 * @returns The deep cloned data, typed as a deep-mutable mirror of `T`.
 */
export const deepClone = <T>(originalData: T, options?: Options): DeepReadwrite<T> => runClone(originalData, resolveClone(options));

/**
 * Create a pre-configured deep-clone function (à la fast-copy's `createCopier`).
 *
 * The handler table is resolved once, so the returned function avoids the per-call
 * options/handler resolution overhead — useful in hot loops cloning many values
 * with the same configuration.
 * @param options The cloning options applied to every call of the returned function.
 * @returns A `deepClone`-compatible function bound to the resolved options.
 */
export const createDeepClone = (options?: Options): <T>(originalData: T) => DeepReadwrite<T> => {
    const clone = resolveClone(options);

    return <T>(originalData: T): DeepReadwrite<T> => runClone(originalData, clone);
};

export type { DeepReadwrite };
export type { Handlers, Options, State } from "./types";
