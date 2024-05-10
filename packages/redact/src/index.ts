// eslint-disable-next-line import/no-extraneous-dependencies
import { hasProperty, setProperty } from "dot-prop";

import stringAnonymize from "./string-anonymizer";
import type { Anonymize, InternalAnonymize, Modifiers } from "./types";
import isJson from "./utils/is-json";
import isValidUrl from "./utils/is-valid-url";
import parseUrlParameters from "./utils/parse-url-params";
import wildcard from "./utils/wildcard";

type SaveCopy = (original: unknown, copy: unknown) => void;
type ExaminedObjects = {
    copy: unknown;
    original: unknown;
};

const circularReferenceKey = "__redact_circular_reference__";

// eslint-disable-next-line sonarjs/cognitive-complexity
const findModifier = (modifiers: Anonymize[], key: string, currentIdentifier?: string): Anonymize | undefined => {
    const isMatch = (modifier: Anonymize): boolean => {
        let modifierFound = false;

        if (modifier.key === key || modifier.key === currentIdentifier) {
            modifierFound = true;
        }

        if (modifier.deep) {
            return modifierFound;
        }

        if (!modifierFound && wildcard(key, modifier.key)) {
            return true;
        }

        if (currentIdentifier) {
            if (!modifierFound && wildcard(currentIdentifier, modifier.key)) {
                return true;
            }

            if (modifier.key.split(".").length === currentIdentifier.split(".").length) {
                return modifierFound;
            }
        }

        return false;
    };

    // eslint-disable-next-line no-restricted-syntax
    for (const modifier of modifiers) {
        if (isMatch(modifier)) {
            return modifier;
        }
    }

    return undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recursivelyFilterAttributes = <V = Record<string, any>>(
    copy: V,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    modifiers: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): void => {
    // eslint-disable-next-line no-restricted-syntax
    for (const modifier of modifiers) {
        // fast direct match
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!modifier.wildcard && !modifier.deep && hasProperty(copy as Record<string, any>, modifier.key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setProperty(copy as Record<string, any>, modifier.key, modifier.replacement);
        } else {
            // eslint-disable-next-line no-restricted-syntax,guard-for-in
            for (const key in copy) {
                const currentIdentifier = identifier ? `${identifier}.${key}` : key;

                if (modifier.deep && !modifier.wildcard && key === modifier.key) {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    copy[key] = modifier.replacement;
                } else if (modifier.wildcard && (wildcard(key, modifier.key) || wildcard(currentIdentifier, modifier.key))) {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    copy[key] = modifier.replacement;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign,security/detect-object-injection
                    copy[key] = recursiveFilter(copy[key] as V, examinedObjects, saveCopy, [modifier], options, currentIdentifier);
                }
            }
        }
    }
};

const recursiveFilter = <V, R = V>(
    input: V,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    modifiers: Modifiers,
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): R => {
    if (input == null) {
        return input as unknown as R;
    }

    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    // eslint-disable-next-line security/detect-object-injection
    const id: number | undefined = input[circularReferenceKey];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (id != null || id === 0) {
        // eslint-disable-next-line security/detect-object-injection
        return examinedObjects[id]?.copy as R;
    }

    const preparedModifiers: InternalAnonymize[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const modifier of modifiers) {
        if (typeof modifier === "string") {
            const hasWildcard = modifier.includes("*");
            preparedModifiers.push({ deep: false, key: modifier, replacement: "<" + modifier.toUpperCase() + ">", wildcard: hasWildcard });
        } else if (typeof modifier === "number") {
            preparedModifiers.push({ deep: false, key: modifier.toString(), replacement: "<REDACTED>" });
        } else {
            if (modifier.key.includes("*")) {
                (modifier as InternalAnonymize).wildcard = true;
            }

            if (!modifier.replacement) {
                (modifier as InternalAnonymize).replacement = "<" + modifier.key.toUpperCase() + ">";
            }

            preparedModifiers.push(modifier);
        }
    }

    if (typeof input === "string" || input instanceof String) {
        if (isJson(input as string)) {
            try {
                const parsed = JSON.parse(input as string);

                if (typeof parsed !== "object" || parsed == null || typeof parsed !== "string") {
                    return input as unknown as R;
                }

                const filtered = recursiveFilter(parsed, examinedObjects, saveCopy, preparedModifiers, options, identifier);

                return JSON.stringify(filtered) as unknown as R;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                options?.logger?.debug(error);
            }
        }

        if (isValidUrl(input as string)) {
            const filtered = parseUrlParameters(input as string).map(({ key, value }) => {
                if (key == null) {
                    const matchedModifier = findModifier(preparedModifiers, value);

                    if (matchedModifier) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        return matchedModifier.replacement ?? `<${matchedModifier.key.toUpperCase()}>`;
                    }

                    return value;
                }

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
                    return `${key}=${matchedModifier.replacement ?? `<${matchedModifier.key.toUpperCase()}>`}`;
                }

                return `${key}=${value}`;
            });

            return filtered.join("") as R;
        }

        return stringAnonymize(input as string, preparedModifiers, options) as unknown as R;
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        saveCopy(input, copy);

        // eslint-disable-next-line no-restricted-syntax
        for (const [index, item] of input.entries()) {
            const currentIdentifier = identifier ? `${identifier}.${index.toString()}` : index.toString();
            const foundModifier = preparedModifiers.find((modifier) => modifier.key === index.toString() || modifier.key === currentIdentifier);

            if (foundModifier) {
                copy.push(foundModifier.replacement ?? "<REDACTED>");

                // eslint-disable-next-line no-param-reassign
                identifier = undefined;
            } else {
                copy.push(recursiveFilter(item, examinedObjects, saveCopy, preparedModifiers, options, currentIdentifier));
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

            // eslint-disable-next-line guard-for-in,no-restricted-syntax
            for (const key in input) {
                // @ts-expect-error we're literally iterating through attributes, these will exist
                // eslint-disable-next-line security/detect-object-injection
                copy[key] = input[key];
            }

            saveCopy(input, copy);
            recursivelyFilterAttributes<V>(copy as V, examinedObjects, saveCopy, preparedModifiers, options, identifier);

            return copy as unknown as R;
        }

        if (input instanceof Map) {
            const copy = new Map();
            const iterator = input.entries();

            let result = iterator.next();

            while (result.done != null && !result.done) {
                const [key, value] = result.value;

                if (typeof key === "string" || key instanceof String) {
                    const matchedModifier = findModifier(preparedModifiers, key as string);

                    if (matchedModifier) {
                        copy.set(key, matchedModifier.replacement ?? `<${matchedModifier.key.toUpperCase()}>`);
                    } else {
                        copy.set(key, recursiveFilter(value, examinedObjects, saveCopy, preparedModifiers, options, identifier));
                    }
                } else {
                    copy.set(
                        recursiveFilter(key, examinedObjects, saveCopy, preparedModifiers, options, identifier),
                        recursiveFilter(value, examinedObjects, saveCopy, preparedModifiers, options, identifier),
                    );
                }

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy as unknown as R;
        }

        if (input instanceof Set) {
            const copy = new Set();
            const iterator = input.values();

            let result = iterator.next();

            while (result.done != null && !result.done) {
                copy.add(recursiveFilter(result.value, examinedObjects, saveCopy, preparedModifiers, options, identifier));

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy as unknown as R;
        }

        const copy = { ...input };

        saveCopy(input, copy);
        recursivelyFilterAttributes<V>(copy, examinedObjects, saveCopy, preparedModifiers, options, identifier);

        return copy as unknown as R;
    }

    return input as unknown as R;
};

// eslint-disable-next-line import/no-unused-modules
export type RedactOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const returnValue = recursiveFilter<V, R>(input, examinedObjects, saveCopy, modifiers, options);

    // eslint-disable-next-line no-restricted-syntax
    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion

        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return returnValue;
}
