type InternalHandler<Value> = (value: Value, state: State) => Value;

export interface State {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: WeakMap<any, unknown>;
    clone: InternalHandler<unknown>;
}

export type Options = {
    handler?: {
        Array: InternalHandler<unknown[]>;
        ArrayBuffer: InternalHandler<ArrayBuffer>;
        Blob: InternalHandler<Blob>;
        DataView: InternalHandler<DataView>;
        Date: InternalHandler<Date>;
        Error: InternalHandler<Error>;
        Float32Array: InternalHandler<Float32Array>;
        Float64Array: InternalHandler<Float64Array>;
        Int8Array: InternalHandler<Int8Array>;
        Int16Array: InternalHandler<Int16Array>;
        Int32Array: InternalHandler<Int32Array>;
        Map: InternalHandler<Map<unknown, unknown>>;
        Object: InternalHandler<Record<string, unknown>>;
        Promise: InternalHandler<Promise<unknown>>;
        RegExp: InternalHandler<RegExp>;
        Set: InternalHandler<Set<unknown>>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        WeakMap: InternalHandler<WeakMap<any, unknown>>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        WeakSet: InternalHandler<WeakSet<any>>;
    };
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
