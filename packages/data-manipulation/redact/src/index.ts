// eslint-disable-next-line import/no-extraneous-dependencies
import { hasProperty, setProperty } from "dot-prop";

import stringAnonymize from "./string-anonymizer";
import type { InternalAnonymize, RedactOptions, Rules } from "./types";
import isJson from "./utils/is-json";
import parseUrlParameters from "./utils/parse-url-parameters";
import wildcard from "./utils/wildcard";

type SaveCopy = (original: unknown, copy: unknown) => void;
type ExaminedObjects = {
    copy: unknown;
    original: unknown;
};

const circularReferenceKey = "__redact_circular_reference__";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recursivelyFilterAttributes = <V = Record<string, any>>(
    copy: V,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): void => {
    for (const modifier of rules) {
        // fast direct match
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!modifier.wildcard && !modifier.deep && hasProperty(copy as Record<string, any>, modifier.key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setProperty(copy as Record<string, any>, modifier.key, modifier.replacement);
        } else {
            // eslint-disable-next-line no-restricted-syntax,guard-for-in
            for (const key in copy) {
                const currentIdentifier = identifier ? `${identifier}.${key.toLowerCase()}` : key.toLowerCase();

                if (!modifier.wildcard && key.toLowerCase() === modifier.key) {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    copy[key] = modifier.replacement;
                } else if (modifier.wildcard && (wildcard(key.toLowerCase(), modifier.key) || wildcard(currentIdentifier.toLowerCase(), modifier.key))) {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    copy[key] = modifier.replacement;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign,security/detect-object-injection
                    copy[key] = recursiveFilter(copy[key] as V, examinedObjects, saveCopy, [modifier], options, currentIdentifier.toLowerCase());
                }
            }
        }
    }
};

const recursiveFilter = <V, R = V>(
    input: V,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): R => {
    if (input == undefined) {
        return input as unknown as R;
    }

    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    // eslint-disable-next-line security/detect-object-injection
    const id: number | undefined = input[circularReferenceKey];

    if (id != undefined || id === 0) {
        // eslint-disable-next-line security/detect-object-injection
        return examinedObjects[id]?.copy as R;
    }

    if (typeof input === "object" && !Array.isArray(input)) {
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
            if (input.code != undefined) {
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
            recursivelyFilterAttributes<V>(copy as V, examinedObjects, saveCopy, rules, options, identifier);

            return copy as unknown as R;
        }

        if (input instanceof Map) {
            const copy = new Map();
            const iterator = input.entries();

            let result = iterator.next();

            while (result.done != undefined && !result.done) {
                const [key, value] = result.value;

                if (typeof key === "string" || key instanceof String) {
                    let modifierFound = false;

                    for (const modifier of rules) {
                        const lowerCaseKey = (key as string).toLowerCase();

                        if (modifier.key === lowerCaseKey || (modifier.wildcard && wildcard(lowerCaseKey, modifier.key))) {
                            modifierFound = true;

                            copy.set(key, modifier.replacement);
                        }
                    }

                    if (!modifierFound) {
                        copy.set(key, recursiveFilter(value, examinedObjects, saveCopy, rules, options));
                    }
                } else {
                    copy.set(
                        recursiveFilter(key, examinedObjects, saveCopy, rules, options),
                        recursiveFilter(value, examinedObjects, saveCopy, rules, options),
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

            while (result.done != undefined && !result.done) {
                copy.add(recursiveFilter(result.value, examinedObjects, saveCopy, rules, options, identifier));

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy as unknown as R;
        }

        const copy = { ...input };

        saveCopy(input, copy);
        recursivelyFilterAttributes<V>(copy, examinedObjects, saveCopy, rules, options, identifier);

        return copy as unknown as R;
    }

    if (typeof input === "string" || input instanceof String) {
        if (isJson(input as string)) {
            try {
                const parsed = JSON.parse(input as string);

                if ((typeof parsed !== "object" && typeof parsed !== "string") || parsed == undefined) {
                    return input as unknown as R;
                }

                const filtered = recursiveFilter(parsed, examinedObjects, saveCopy, rules, options, identifier);

                return JSON.stringify(filtered) as unknown as R;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                options?.logger?.debug(error);
            }
        }

        // check if it's an url with parameters
        if (/(?:http|https):\/\/?/.test(input as string)) {
            const parsedUrlParameters = parseUrlParameters(input as string);

            const filtered = [];

            for (const { key, value } of parsedUrlParameters) {
                if (key == undefined) {
                    const foundModifier = rules.find((modifier) => modifier.key === value.toLowerCase());

                    if (foundModifier) {
                        filtered.push(foundModifier.replacement);
                    } else {
                        filtered.push(value);
                    }
                } else {
                    const foundModifier = rules.find((modifier) => modifier.key === key.toLowerCase());

                    if (foundModifier) {
                        filtered.push(`${key}=${foundModifier.replacement}`);
                    } else {
                        filtered.push(`${key}=${value}`);
                    }
                }
            }

            return filtered.join("") as R;
        }

        return stringAnonymize(input as string, rules, { logger: options?.logger }) as unknown as R;
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        saveCopy(input, copy);

        for (const [index, item] of input.entries()) {
            const currentIdentifier = identifier ? `${identifier}.${index.toString()}`.toLowerCase() : index.toString().toLowerCase();
            const foundModifier = rules.find((modifier) => modifier.key === index.toString().toLowerCase() || modifier.key === currentIdentifier);

            if (foundModifier) {
                copy.push(foundModifier.replacement);

                // eslint-disable-next-line no-param-reassign
                identifier = undefined;
            } else {
                copy.push(recursiveFilter(item, examinedObjects, saveCopy, rules, options, currentIdentifier));
            }
        }

        return copy as unknown as R;
    }

    return input as unknown as R;
};

export function redact<V = string, R = V>(input: V, rules: Rules, options?: RedactOptions): R;
export function redact<V = Error, R = V>(input: V, rules: Rules, options?: RedactOptions): R;
export function redact<V = Record<string, unknown>, R = V>(input: V, rules: Rules, options?: RedactOptions): R;
export function redact<V = unknown[], R = V>(input: V, rules: Rules, options?: RedactOptions): R;
export function redact<V = Map<unknown, unknown>, R = V>(input: V, rules: Rules, options?: RedactOptions): R;
export function redact<V = Set<unknown>, R = V>(input: V, rules: Rules, options?: RedactOptions): R;

// eslint-disable-next-line sonarjs/cognitive-complexity
export function redact<V, R>(input: V, rules: Rules, options?: RedactOptions): R {
    if (input == undefined || typeof input === "number" || typeof input === "boolean") {
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

    const preparedModifiers: InternalAnonymize[] = [];

    for (const modifier of rules) {
        if (
            options?.exclude
            && ((typeof modifier === "string" && options.exclude.includes(modifier))
                || (typeof modifier === "number" && options.exclude.includes(modifier))
                || (typeof modifier === "object" && options.exclude.includes(modifier.key)))
        ) {
            continue;
        }

        if (typeof modifier === "string") {
            const hasWildcard = modifier.includes("*");

            preparedModifiers.push({ deep: false, key: modifier.toLowerCase(), replacement: `<${modifier.toUpperCase()}>`, wildcard: hasWildcard });
        } else if (typeof modifier === "number") {
            preparedModifiers.push({ deep: false, key: modifier.toString(), replacement: "<REDACTED>" });
        } else {
            modifier.key = modifier.key.toLowerCase();

            if (modifier.key.includes("*")) {
                (modifier as InternalAnonymize).wildcard = true;
            }

            if (!modifier.replacement) {
                (modifier as InternalAnonymize).replacement = `<${modifier.key.toUpperCase()}>`;
            }

            preparedModifiers.push(modifier);
        }
    }

    const returnValue = recursiveFilter<V, R>(input, examinedObjects, saveCopy, preparedModifiers, options);

    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion

        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return returnValue;
}

export { default as standardRules } from "./rules";
export { default as stringAnonymize } from "./string-anonymizer";
export type { Anonymize, RedactOptions, Rules } from "./types";
