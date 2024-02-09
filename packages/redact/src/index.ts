import { getType } from "./utils/get-type";

const examinedObjects: { copy: unknown; original: unknown }[] = [];
const circularReferenceKey = "__c1rc1ul4r_r3f3r3nc3_k3y__";

const saveCopy = (original: unknown, copy: unknown) => {
    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
    original[circularReferenceKey] = examinedObjects.length; // id

    examinedObjects.push({
        copy,
        original,
    });
};

type Options = {
    filters: {
        isApplicable: (value: any, key: number | string | undefined) => boolean;
        transform: (value: any) => any;
    }[];
};

let deepObjectKey: string = "";

// eslint-disable-next-line sonarjs/cognitive-complexity
const recursiveFilter = <V, R = V>(input: V, options: Options): R => {
    if (getType(input) === "Array") {
        const copy = [];

        saveCopy(input, copy);

        const inputKeys = Object.keys(input);
        const inputKeysLength = inputKeys.length;

        let inputKeysIndex = 0;

        // eslint-disable-next-line no-loops/no-loops
        while (inputKeysIndex < inputKeysLength) {
            // eslint-disable-next-line security/detect-object-injection
            const value = input[inputKeysIndex];
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            const filter = options.filters.find((f) => f.isApplicable(value, inputKeysIndex));

            // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unsafe-argument
            copy[inputKeysIndex] = filter ? filter.transform(value) : recursiveFilter<V, R>(value, options);

            // eslint-disable-next-line no-plusplus
            inputKeysIndex++;
        }

        return copy as unknown as R;
    }

    if (getType(input) === "Error") {
    }

    if (getType(input) === "Object") {
        const copy = { ...input };

        saveCopy(input, copy);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,guard-for-in
        for (const key in copy) {
            deepObjectKey += (deepObjectKey === "" ? "" : ".") + key;

            // eslint-disable-next-line security/detect-object-injection
            const value = copy[key];
            const filter = options.filters.find((f) => f.isApplicable(value, deepObjectKey));

            // eslint-disable-next-line security/detect-object-injection
            copy[key] = filter ? filter.transform(value) : recursiveFilter<V, R>(value, options);

            deepObjectKey = "";
        }

        return copy as unknown as R;
    }

    if (getType(input) === "String") {
    }

    return input as unknown as R;
};

function redact<V = string, R = V>(input: V, options: Options): R;
function redact<V = Error, R = V>(input: V, options: Options): R;
function redact<V = Record<string, unknown>, R = V>(input: V, options: Options): R;
function redact<V = unknown[], R = V>(input: V, options: Options): R;
function redact<V = Map<unknown, unknown>, R = V>(input: V, options: Options): R;
function redact<V = Set<unknown>, R = V>(input: V, options: Options): R;

// eslint-disable-next-line func-style
function redact<V, R>(input: V, options: Options): R {
    const ouput = recursiveFilter<V, R>(input, options);

    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return ouput;
}

export default redact;
