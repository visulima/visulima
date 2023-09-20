import type { TypedArray, UnknownRecord } from "type-fest";

type OnIteration = (function_: (oData: any) => unknown, levelData: unknown[] | UnknownRecord, clonedData: unknown[] | UnknownRecord, key: PropertyKey) => void;

type DataType = "buffer" | "date" | "jsdom" | "map" | "object" | "primitive" | "regex" | "set" | "unknown";

type DataTypeChecker = (object: any) => boolean;

type ObjectDataTypeHandler = (
    object: any,
    useProto: boolean,
    beforeIteration: (data: unknown, clonedData: unknown) => void,
    onIteration: OnIteration,
    afterIteration: () => void,
) => any;

interface ArrayDataTypeMapping {
    checker: DataTypeChecker;
    handler: (object: any) => any;
    type: DataType;
}

interface ObjectDataTypeMapping {
    checker: DataTypeChecker;
    handler: ObjectDataTypeHandler;
    type: DataType;
}

// eslint-disable-next-line @typescript-eslint/ban-types
const canValueHaveProperties = (value: unknown): value is NonNullable<Function | object> =>
    (typeof value === "object" && value !== null) || typeof value === "function";

const copyBuffer = (current: ArrayBuffer | ArrayBufferView | Buffer | TypedArray): ArrayBuffer | ArrayBufferView | Buffer | TypedArray => {
    const typeHandlers: Record<string, new (buffer: any) => any> = {
        BigInt64Array,
        BigUint64Array,
        // @ts-expect-error - Buffer has no constructor
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Buffer: Buffer.from,
        Float32Array,
        Float64Array,
        Int8Array,
        Int16Array,
        Int32Array,
        Uint8Array,
        Uint8ClampedArray,
        Uint16Array,
        Uint32Array,
    };

    if (current instanceof ArrayBuffer) {
        const newBuffer = new ArrayBuffer(current.byteLength);
        const origView = new Uint8Array(current);
        const newView = new Uint8Array(newBuffer);

        newView.set(origView);

        return newBuffer;
    }

    const Ctor = typeHandlers[current.constructor.name];

    if (Ctor) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return new Ctor(current);
    }

    // @ts-expect-error - Fallback to ArrayBufferView
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new (current as ArrayBufferView).constructor([...current.buffer], current.byteOffset, current.length);
};

interface FakeJSDOM {
    cloneNode?: (check: boolean) => unknown;
    nodeType?: unknown;
}

const arrayCheckerHandlers: ArrayDataTypeMapping[] = [
    {
        checker: (object: any) => object instanceof Date,
        handler: (object: any) => new Date(object as Date),
        type: "date",
    },
    {
        checker: (object: any) => object instanceof RegExp,
        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
        handler: (object: RegExp | string) => new RegExp(object),
        type: "regex",
    },
    {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        checker: (object: FakeJSDOM): object is FakeJSDOM => object?.nodeType !== undefined && object.cloneNode !== undefined,
        handler: (object: Required<FakeJSDOM>) => object.cloneNode(true),
        type: "jsdom",
    },
    {
        checker: (object: any) => ArrayBuffer.isView(object),
        handler: (object: ArrayBuffer | ArrayBufferView | Buffer | TypedArray) => copyBuffer(object),
        type: "buffer",
    },
    {
        checker: (object: any) => typeof object !== "object" || object === null,
        // eslint-disable-next-line @typescript-eslint/ban-types
        handler: (object: Function | bigint | boolean | number | string | symbol | null | undefined) => object,
        type: "primitive",
    },
];

const objectCheckerHandlers: ObjectDataTypeMapping[] = [
    ...(arrayCheckerHandlers as unknown as ObjectDataTypeMapping[]),
    {
        checker: (object: any) => object instanceof Map,
        handler: (
            object: any,
            useProto: boolean,
            beforeIteration: (data: unknown, clonedData: unknown) => void,
            onIteration: OnIteration,
            afterIteration: () => void,
        ) =>
            new Map(
                // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-use-before-define
                cloneArray([...(object as [])], onIteration, clone(useProto, beforeIteration, onIteration, afterIteration)) as ReadonlyArray<
                    [unknown, unknown]
                >,
            ),
        type: "map",
    },
    {
        checker: (object) => object instanceof Set,
        handler: (
            object: any,
            useProto: boolean,
            beforeIteration: (data: unknown, clonedData: unknown) => void,
            onIteration: OnIteration,
            afterIteration: () => void,
            // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-use-before-define
        ) => new Set(cloneArray([...(object as [])], onIteration, clone(useProto, beforeIteration, onIteration, afterIteration))),
        type: "set",
    },
];

const getPropertyKeys = (object: any): (string | symbol)[] => [...Object.getOwnPropertyNames(object), ...Object.getOwnPropertySymbols(object)];

const cloneArray = (array: any[], onIteration: OnIteration, function_: (values: unknown) => unknown): unknown[] => {
    const cloned = Array.from({ length: array.length });

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < array.length; index++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const current = array[index];
        const handlerData = arrayCheckerHandlers.find((ch) => ch.checker(current));

        if (handlerData) {
            cloned[index] = handlerData.handler(current);
        } else {
            onIteration(function_, array, cloned, index);
        }
    }

    return cloned;
};

const invalidCloneTypeCheckers: ((object: any) => boolean)[] = [
    (object: any) => object instanceof WeakMap,
    (object: any) => object instanceof WeakSet,
    (object: any) => object instanceof SharedArrayBuffer,
    (object: any) => object instanceof DataView,
    (object: any) => object instanceof Promise,
];

const clone =
    (useProto: boolean | undefined, beforeIteration: (data: unknown, clonedData: unknown) => void, onIteration: OnIteration, afterIteration: () => void) =>
    // eslint-disable-next-line sonarjs/cognitive-complexity
    (data: any): unknown => {
        if (typeof data !== "object" || data === null || typeof data === "function") {
            return data;
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const handlerData of objectCheckerHandlers) {
            if (handlerData.checker(data)) {
                return handlerData.handler(data, useProto ?? false, beforeIteration, onIteration, afterIteration);
            }
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const invalidTypeChecker of invalidCloneTypeCheckers) {
            if (invalidTypeChecker(data)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                throw new TypeError(`${data.constructor.name} objects cannot be cloned`);
            }
        }

        if (Array.isArray(data)) {
            return cloneArray(data, onIteration, clone(useProto, beforeIteration, onIteration, afterIteration));
        }

        const clonedObject: UnknownRecord = {};

        beforeIteration(data, clonedObject);

        // eslint-disable-next-line no-restricted-syntax
        for (const propertyKey of getPropertyKeys(data)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const current = (Object.getOwnPropertyDescriptor(data, propertyKey) as PropertyDescriptor).value;

            if (typeof current !== "object" || current === null) {
                clonedObject[propertyKey] = current;
            } else {
                const handlerData = objectCheckerHandlers.find((ch) => ch.checker(current));

                if (handlerData) {
                    clonedObject[propertyKey] = handlerData.handler(current, useProto ?? false, beforeIteration, onIteration, afterIteration);
                } else {
                    onIteration(clone(useProto, beforeIteration, onIteration, afterIteration), data as unknown[] | UnknownRecord, clonedObject, propertyKey);
                }
            }
        }

        if (useProto) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const objectPrototype: object | null = Object.getPrototypeOf(data);

            if (Object.getPrototypeOf(clonedObject) !== objectPrototype) {
                Object.setPrototypeOf(clonedObject, objectPrototype);
            }
        }

        afterIteration();

        return clonedObject;
    };

const cloneCircles = <T>(originalData: T, useProto: boolean | undefined) => {
    const references = new Map<unknown, unknown>();

    return clone(
        useProto,
        (object_, clonedObject) => {
            references.set(object_, clonedObject);
        },
        (function_, data, clonedObject, key) => {
            // @ts-expect-error - We don't know the type of the data, can be an object or array
            if (references.has(data[key])) {
                // @ts-expect-error - We don't know the type of the data, can be an object or array
                // eslint-disable-next-line no-param-reassign
                (clonedObject as unknown[] | UnknownRecord)[key] = references.get(data[key]);
            } else if (Array.isArray(data)) {
                // @ts-expect-error - We don't know the type of the data, can be an object or array
                // eslint-disable-next-line no-param-reassign
                clonedObject[key as number] = function_(data[key]);
            } else {
                const propertyDescriptor = Object.getOwnPropertyDescriptor(data, key);

                if (propertyDescriptor?.value) {
                    propertyDescriptor.value = function_(propertyDescriptor.value);

                    Object.defineProperty(clonedObject, key, propertyDescriptor);
                }
            }
        },
        () => {
            references.delete(originalData);
        },
    )(originalData);
};

type DeepReadwrite<T> = T extends object | [] ? { -readonly [P in keyof T]: DeepReadwrite<T[P]> } : T;

interface Options {
    circles?: boolean;
    proto?: boolean;
}

const deepClone = <T = unknown>(originalData: T, options?: Options): DeepReadwrite<T> => {
    if (!canValueHaveProperties(originalData)) {
        return originalData as DeepReadwrite<T>;
    }

    if (options?.circles) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return cloneCircles<T>(originalData, options?.proto) as DeepReadwrite<T>;
    }

    return clone(
        options?.proto,
        () => {},
        (function_, data, clonedObject, key) => {
            // @ts-expect-error - We don't know the type of the data, can be an object or array
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const propertyValue = data[key];

            if (Array.isArray(data)) {
                // eslint-disable-next-line no-param-reassign
                clonedObject[key as number] = function_(propertyValue);
            } else {
                // Assign properties if possible to avoid expensive operations
                // @ts-expect-error - We don't know the type of the data, can be an object or array
                // eslint-disable-next-line no-param-reassign
                clonedObject[key] = function_(propertyValue);
            }
        },
        () => {},
    )(originalData) as DeepReadwrite<T>;
};

export default deepClone;
