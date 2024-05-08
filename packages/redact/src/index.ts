import { stringAnonymize } from "./string-anonymizer";
import type { Anonymize, Modifiers } from "./types";
import { clone } from "./utils/simple-clone";
import wildcard from "./wildcard";

type SaveCopy = (original: unknown, copy: unknown) => void;
type ExaminedObjects = {
    copy: unknown;
    original: unknown;
};

const circularReferenceKey = "__redact_circular_reference__";

// eslint-disable-next-line sonarjs/cognitive-complexity
const recursivelyFilterAttributes = <V>(copy: V, examinedObjects: ExaminedObjects[], saveCopy: SaveCopy, modifiers: Anonymize[], identifier?: string): void => {
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
                // @ts-expect-error we're literally iterating through attributes, these will exist
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

// eslint-disable-next-line sonarjs/cognitive-complexity
const recursiveFilter = <V, R = V>(input: V, examinedObjects: ExaminedObjects[], saveCopy: SaveCopy, modifiers: Modifiers, identifier?: string): R => {
    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    // eslint-disable-next-line security/detect-object-injection
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

        if (typeof modifier === "number") {
            return { deep: false, key: modifier.toString() };
        }

        return modifier;
    }) as Anonymize[];

    if (typeof input === "string" || input instanceof String) {
        return stringAnonymize(input as string, preparedModifiers) as unknown as R;
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        saveCopy(input, copy);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [index, item] of input.entries()) {
            const currentIdentifier = identifier ? `${identifier}.${index.toString()}` : index.toString();
            const foundModifier = preparedModifiers.find((modifier) => modifier.key === index.toString() || modifier.key === currentIdentifier);

            if (foundModifier) {
                copy.push(foundModifier.replacement ?? "<REDACTED>");

                // eslint-disable-next-line no-param-reassign
                identifier = undefined;
            } else {
                copy.push(recursiveFilter(item, examinedObjects, saveCopy, preparedModifiers, currentIdentifier));
            }
        }

        return copy as unknown as R;
    }

    if (typeof input === "object") {
        if (input instanceof Error) {
            const copy = new Error(input.message);

            Object.defineProperties(copy, {
                name: {
                    configurable: true,
                    enumerable: false,
                    value: input.name,
                    writable: true,
                },
                stack: {
                    configurable: true,
                    enumerable: false,
                    value: input.stack,
                    writable: true,
                },
            });
            // @ts-expect-error we handle specific errors that have codes
            if (input.code != null) {
                // @ts-expect-error we handle specific errors that have codes
                copy.code = input.code;
            }

            // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
            for (const key in input) {
                // @ts-expect-error we're literally iterating through attributes, these will exist
                // eslint-disable-next-line security/detect-object-injection
                copy[key] = input[key];
            }
        } else if (input instanceof Map) {
            const copy = new Map();
            const iterator = input.entries();

            let result = iterator.next();

            // eslint-disable-next-line no-loops/no-loops
            while (result.done != null && !result.done) {
                const [key, value] = result.value;

                if (typeof key === "string" || key instanceof String) {
                    const matchedModifier = preparedModifiers.find((modifier) => {
                        let modifierFound = false;

                        if (modifier.key === key) {
                            modifierFound = true;
                        }

                        if (!modifierFound && wildcard(key as string, modifier.key)) {
                            return true;
                        }

                        if (modifier.deep) {
                            return modifierFound;
                        }

                        return false;
                    });

                    if (matchedModifier) {
                        copy.set(key, matchedModifier.replacement ?? `<${matchedModifier.key.toUpperCase()}>`);
                    } else {
                        copy.set(key, recursiveFilter(value, examinedObjects, saveCopy, preparedModifiers, identifier));
                    }
                } else {
                    copy.set(
                        recursiveFilter(key, examinedObjects, saveCopy, preparedModifiers, identifier),
                        recursiveFilter(value, examinedObjects, saveCopy, preparedModifiers, identifier),
                    );
                }

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy as unknown as R;
        } else if (input instanceof Set) {
            const copy = new Set();
            const iterator = input.values();

            let result = iterator.next();

            // eslint-disable-next-line no-loops/no-loops
            while (result.done != null && !result.done) {
                copy.add(recursiveFilter(result.value, examinedObjects, saveCopy, preparedModifiers, identifier));

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy as unknown as R;
        }

        const copy = clone<V>(input);

        saveCopy(input, copy);
        recursivelyFilterAttributes<V>(copy, examinedObjects, saveCopy, preparedModifiers, identifier);

        return copy as unknown as R;
    }

    return input as unknown as R;
};

export type RedactOptions = {
    logger?: { debug: (...arguments_: any[]) => void };
};

export function redact<V = string, R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;
export function redact<V = Error, R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;
export function redact<V = Record<string, unknown>, R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;
export function redact<V = unknown[], R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;
export function redact<V = Map<unknown, unknown>, R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;
export function redact<V = Set<unknown>, R = V>(input: V, modifiers: Modifiers, options?: RedactOptions): R;

// eslint-disable-next-line func-style
export function redact<V, R>(input: V, modifiers: Modifiers, options?: RedactOptions): R {
    if (input == null || typeof input === "number" || typeof input === "boolean") {
        return input as unknown as R;
    }

    const examinedObjects: ExaminedObjects[] = [];

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

    const returnValue = recursiveFilter<V, R>(input, examinedObjects, saveCopy, modifiers);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion

        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return returnValue;
}
