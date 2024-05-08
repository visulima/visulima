import { stringAnonymize } from "./string-anonymizer";
import type { Anonymize, Modifiers } from "./types";
import { clone } from "./utils/simple-clone";
import wildcard from "./wildcard";

type Options = {
    strictCopy?: boolean;
};

type SaveCopy = (original: unknown, copy: unknown) => void;

const circularReferenceKey = "__redact_circular_reference__";

const recursivelyFilterAttributes = <V>(copy: V, examinedObjects: Record<any, any>[], saveCopy: SaveCopy, modifiers: Anonymize[], identifier?: string) => {
    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in copy) {
        if (Object.prototype.hasOwnProperty.call(copy, key)) {
            const currentIdentifier = identifier ? `${identifier}.${key}` : key;
            const matchedModifier = modifiers.find((modifier) => {
                let modifierFound = false;

                if (modifier.key === key || modifier.key === currentIdentifier) {
                    modifierFound = true;
                }

                if (!modifierFound && (wildcard(key, modifier.key) || wildcard(currentIdentifier, modifier.key))) {
                    return true;
                }

                if (modifier.deep) {
                    return modifierFound;
                }

                if (modifier.key.split(".").length === currentIdentifier.split(".").length) {
                    return modifierFound;
                }

                return false;
            });

            if (matchedModifier) {
                // eslint-disable-next-line security/detect-object-injection,no-param-reassign
                copy[key] = matchedModifier.replacement ?? `<${matchedModifier.key.toUpperCase()}>`;

                // eslint-disable-next-line no-param-reassign
                identifier = undefined;
            } else {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define,security/detect-object-injection,no-param-reassign
                copy[key] = recursiveFilter(copy[key], examinedObjects, saveCopy, modifiers, currentIdentifier);
            }
        }
    }
};

const recursiveFilter = <V, R = V>(input: V, examinedObjects: Record<any, any>[], saveCopy: SaveCopy, modifiers: Modifiers, identifier?: string): R => {
    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    const id: number | undefined = input[circularReferenceKey];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (id != null || id === 0) {
        // eslint-disable-next-line security/detect-object-injection
        return examinedObjects[id]?.copy as R;
    }

    const preparedModifiers = modifiers.map((modifier) => {
        if (typeof modifier === "string") {
            return { deep: false, key: modifier };
        }

        return modifier;
    });

    if (typeof input === "string" || input instanceof String) {
        return stringAnonymize(input as string, preparedModifiers) as unknown as R;
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        // eslint-disable-next-line no-loops/no-loops
        for (let inputKeysIndex = 0; inputKeysIndex < input.length; ) {
            // const value = input[inputKeysIndex];

            // const filter = options?.filters?.find((f) => f.isApplicable(value, inputKeysIndex));
            //
            // // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unsafe-argument
            // copy[inputKeysIndex] = filter ? filter.transform(value) : recursiveFilter<V, R>(value, options);

            // eslint-disable-next-line no-plusplus
            inputKeysIndex++;
        }

        return copy as unknown as R;
    }

    if (typeof input === "object") {
        if (input instanceof Error) {
        } else if (input instanceof Map) {
        } else if (input instanceof Set) {
        }

        const copy = clone<V>(input);

        saveCopy(input, copy);
        recursivelyFilterAttributes<V>(copy, examinedObjects, saveCopy, preparedModifiers, identifier);

        return copy as unknown as R;
    }

    return input as unknown as R;
};

export function redact<V = string, R = V>(input: V, modifiers: Modifiers, options?: Options): R;
export function redact<V = Error, R = V>(input: V, modifiers: Modifiers, options?: Options): R;
export function redact<V = Record<string, unknown>, R = V>(input: V, modifiers: Modifiers, options?: Options): R;
export function redact<V = unknown[], R = V>(input: V, modifiers: Modifiers, options?: Options): R;
export function redact<V = Map<unknown, unknown>, R = V>(input: V, modifiers: Modifiers, options?: Options): R;
export function redact<V = Set<unknown>, R = V>(input: V, modifiers: Modifiers, options?: Options): R;

// eslint-disable-next-line func-style
export function redact<V, R>(input: V, modifiers: Modifiers, options?: Options): R {
    if (input == null || typeof input === "number" || typeof input === "boolean") {
        return input as unknown as R;
    }

    const examinedObjects: object[] = [];

    const saveCopy = (original: unknown, copy: unknown) => {
        const id = examinedObjects.length;

        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
        // eslint-disable-next-line no-param-reassign,security/detect-object-injection
        original[circularReferenceKey] = id;

        examinedObjects.push({
            copy,
            original,
        });
    };

    const returnValue = recursiveFilter<V, R>(input, examinedObjects, saveCopy, modifiers, options);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return returnValue;
}
