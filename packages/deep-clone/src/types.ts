type InternalHandler<Value> = (value: Value, state: State) => Value;

export interface State {
  cache: WeakMap<any, unknown>;
  clone: InternalHandler<unknown>;
}

export type Options = {
    handler?: {
        Arguments: InternalHandler<unknown[]>;
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
        WeakMap: InternalHandler<WeakMap<object, unknown>>;
        WeakSet: InternalHandler<WeakSet<object>>;
    };
    strict?: boolean;
};
