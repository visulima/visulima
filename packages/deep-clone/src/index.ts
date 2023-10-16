import type { TypedArray, UnknownRecord } from "type-fest";

type OnIteration = (function_: (oData: any) => unknown, levelData: unknown[] | UnknownRecord, clonedData: unknown[] | UnknownRecord, key: PropertyKey) => void;

type DataType = "buffer" | "date" | "error" | "jsdom" | "map" | "object" | "primitive" | "regex" | "set" | "unknown";

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

/**
 * Copy buffer function for cloning ArrayBuffer, ArrayBufferView, Buffer, or TypedArray objects.
 *
 * @param current - The buffer object to be copied. The type of `current` is `ArrayBuffer | ArrayBufferView | Buffer | TypedArray`.
 * @returns The copied buffer object. The return type of the function is `ArrayBuffer | ArrayBufferView | Buffer | TypedArray`.
 */
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

type ExtendedError = Error & { code?: any; errno?: any; syscall?: any };

/**
 * An Array of checker and handler mappings for different data types.
 */
const arrayCheckerHandlers: ArrayDataTypeMapping[] = [
    {
        checker: (object: any) => object instanceof Date,
        handler: (object: any) => new Date(object as Date),
        type: "date",
    },
    {
        checker: (object: any) => object instanceof RegExp,
        handler: (object: RegExp | string) => {
            // eslint-disable-next-line require-unicode-regexp,@rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
            const regexClone = new RegExp(object);

            // Any enumerable properties...
            if (typeof object !== "string") {
                Object.keys(object).forEach((key) => {
                    const desc = Object.getOwnPropertyDescriptor(object, key);

                    if (desc) {
                        // eslint-disable-next-line no-prototype-builtins
                        if (desc.hasOwnProperty("value")) {
                            // eslint-disable-next-line @typescript-eslint/no-use-before-define
                            desc.value = deepClone(object[key as keyof RegExp]);
                        }

                        Object.defineProperty(regexClone, key, desc);
                    }
                });
            }

            return regexClone;
        },
        type: "regex",
    },
    {
        checker: (object: any) => object instanceof Error,
        handler: (object: EvalError | ExtendedError | RangeError | ReferenceError | SyntaxError | TypeError | URIError) => {
            // @ts-expect-error - We don't know the type of the object, can be an error
            const error = new object.constructor(object.message) as
                | EvalError
                | ExtendedError
                | RangeError
                | ReferenceError
                | SyntaxError
                | TypeError
                | URIError;

            // If a `stack` property is present, copy it over...
            if (object.stack) {
                error.stack = object.stack;
            }

            // Node.js specific (system errors)...
            if ((object as ExtendedError).code) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                (error as ExtendedError).code = (object as ExtendedError).code;
            }

            if ((object as ExtendedError).errno) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                (error as ExtendedError).errno = (object as ExtendedError).errno;
            }

            if ((object as ExtendedError).syscall) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                (error as ExtendedError).syscall = (object as ExtendedError).syscall;
            }

            // Any enumerable properties...
            Object.keys(object).forEach((key) => {
                const desc = Object.getOwnPropertyDescriptor(object, key);

                if (desc) {
                    // eslint-disable-next-line no-prototype-builtins
                    if (desc.hasOwnProperty("value")) {
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define
                        desc.value = deepClone(object[key as keyof Error]);
                    }

                    Object.defineProperty(error, key, desc);
                }
            });

            return error;
        },
        type: "error",
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
        handler: (object: Function | bigint | boolean | number | string | symbol | null | undefined) => {
            if (typeof object === "number" || typeof object === "boolean" || typeof object === "string") {
                return object.valueOf();
            }

            return object;
        },
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
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
        ) => new Set(cloneArray([...(object as [])], onIteration, clone(useProto, beforeIteration, onIteration, afterIteration))),
        type: "set",
    },
];

const getPropertyKeys = (object: any): (string | symbol)[] => [...Object.getOwnPropertyNames(object), ...Object.getOwnPropertySymbols(object)];

/**
 * Clones an array by iterating through its elements and applying a function to each element.
 * If an element matches a defined checker function, the element is handled by a corresponding handler function.
 * Otherwise, the element is passed to the provided function for further processing.
 *
 * @param array - The array to clone. The type of `array` is `unknown[]`.
 * @param onIteration - A callback function called for each iteration. It is invoked with the provided function,
 * the original array, the cloned array, and the index of the current element. The type of `onIteration` is a function
 * that accepts four parameters: the provided function of type `(element: unknown) => unknown`, the original array of type `unknown[]`,
 * the cloned array of type `unknown[]`, and the index of the current element of type `number`.
 * @param function_ - The function to apply to each element that does not match a checker function. The type of `function_` is
 * a function that accepts one parameter of type `unknown`.
 * @returns A new array containing the cloned elements. The return type of the function is `unknown[]`.
 */
const cloneArray = (array: any[], onIteration: OnIteration, function_: (values: unknown) => unknown): unknown[] => {
    const cloned = Array.from({ length: array.length });

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
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
    (object: any) => object instanceof Blob,
];

/**
 * Function that clones a given object with optional configuration parameters.
 * It creates a deep clone of the object, including arrays and nested objects.
 * It applies handlers for specific object types, before and after iteration functions,
 * and provides a callback function for each iteration step.
 *
 * @param useProto - Flag indicating whether to use the prototype of the object. The type of `useProto` is `boolean`.
 * @param beforeIteration - Function to be called before each iteration step with the current data
 * being iterated and the cloned data object. The type of `beforeIteration` is a function that
 * accepts two parameters of type `unknown`.
 * @param onIteration - Function to be called for each iteration step with the current data being
 * iterated, the cloned data object, and the property key. The type of `onIteration` is a function
 * that accepts two parameters of type `unknown[] | UnknownRecord` and one parameter of type `string | number`.
 * @param afterIteration - Function to be called after all iterations have completed. The type
 * of `afterIteration` is a function that accepts no parameters.
 * @returns The cloned object. The return type of the function is `unknown`.
 */
const clone =
    (useProto: boolean | undefined, beforeIteration: (data: unknown, clonedData: unknown) => void, onIteration: OnIteration, afterIteration: () => void) =>
    // eslint-disable-next-line sonarjs/cognitive-complexity
    (data: any): unknown => {
        if (typeof data !== "object" || data === null || typeof data === "function") {
            return data;
        }

        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
        for (const handlerData of objectCheckerHandlers) {
            if (handlerData.checker(data)) {
                return handlerData.handler(data, useProto ?? false, beforeIteration, onIteration, afterIteration);
            }
        }

        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
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

        // eslint-disable-next-line no-restricted-syntax,no-loops/no-loops
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

        if (!Object.isExtensible(data)) {
            Object.preventExtensions(clonedObject);
        }

        if (Object.isSealed(data)) {
            Object.seal(clonedObject);
        }

        if (Object.isFrozen(data)) {
            Object.freeze(clonedObject);
        }

        return clonedObject;
    };

/**
 * Function that clones the given data object, including circular references.
 *
 * @template T - The type of the original data.
 * @param originalData - The original data object to clone. It uses the generic parameter `T`.
 * @param useProto - Optional. Whether to use `__proto__` when cloning objects. The type of `useProto` is `boolean`.
 * @returns The cloned data object. The return type is defined by the generic parameter `T`.
 */
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

/**
 * Function that creates a deep clone of an object or array.
 *
 * @template T - The type of the original data.
 * @param originalData - The original data to be cloned. It uses the generic parameter `T`.
 * @param options - Optional. The cloning options. Type of this parameter is `Options`.
 * @returns The deep cloned data with its type as `DeepReadwrite<T>`.
 */
// eslint-disable-next-line import/prefer-default-export,import/no-unused-modules
export const deepClone = <T = unknown>(originalData: T, options?: Options): DeepReadwrite<T> => {
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
