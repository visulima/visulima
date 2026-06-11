type InternalHandler<Value> = (value: Value, state: State) => Value;

export interface State {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: WeakMap<any, unknown>;
    clone: InternalHandler<unknown>;
}

/**
 * The set of per-type copier functions that {@link Options.handler} can override.
 *
 * Every key is optional, so a single custom handler (e.g. `{ Date: myFn }`) is
 * enough — the rest fall back to the built-in defaults. Only the types listed here
 * are dispatched through the handler table; typed arrays are always cloned via the
 * `ArrayBuffer` handler, so they have no dedicated keys.
 */
export type Handlers = {
    Array: InternalHandler<unknown[]>;
    ArrayBuffer: InternalHandler<ArrayBuffer>;
    Blob: InternalHandler<Blob>;
    DataView: InternalHandler<DataView>;
    Date: InternalHandler<Date>;
    Error: InternalHandler<Error>;
    File: InternalHandler<File>;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    Function: InternalHandler<Function>;
    Map: InternalHandler<Map<unknown, unknown>>;
    Object: InternalHandler<Record<string, unknown>>;
    Promise: InternalHandler<Promise<unknown>>;
    RegExp: InternalHandler<RegExp>;
    Set: InternalHandler<Set<unknown>>;
    SharedArrayBuffer: InternalHandler<SharedArrayBuffer>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakMap: InternalHandler<WeakMap<any, unknown>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakSet: InternalHandler<WeakSet<any>>;
};

export type Options = {
    handler?: Partial<Handlers>;
    strict?: boolean;
};

export type TypedArray
    = | BigInt64Array
        | BigUint64Array
        | Float32Array
        | Float64Array
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint8ClampedArray
        | Uint16Array
        | Uint32Array;
