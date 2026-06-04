// eslint-disable-next-line import/no-extraneous-dependencies,e18e/ban-dependencies
import { hasProperty, setProperty } from "dot-prop";

import stringAnonymize from "./string-anonymizer";
import type { InternalAnonymize, RedactOptions, Rules } from "./types";
import parseUrlParameters from "./utils/parse-url-parameters";
import wildcard from "./utils/wildcard";

type SaveCopy = (original: unknown, copy: unknown) => void;
type ExaminedObjects = {
    copy: unknown;
    original: unknown;
};

const circularReferenceKey = "__redact_circular_reference__";
const urlProtocolRegex = /(?:http|https):\/\/?/;

const recursivelyFilterAttributes = (
    copy: Record<string, unknown>,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): void => {
    for (const modifier of rules) {
        // fast direct match
        if (!modifier.wildcard && !modifier.deep && hasProperty(copy, modifier.key)) {
            setProperty(copy, modifier.key, modifier.replacement);
        } else {
            const keys = Object.keys(copy);

            for (const key of keys) {
                const currentIdentifier = identifier ? `${identifier}.${key.toLowerCase()}` : key.toLowerCase();

                if (!modifier.wildcard && key.toLowerCase() === modifier.key) {
                    // eslint-disable-next-line no-param-reassign
                    copy[key] = modifier.replacement;
                } else if (modifier.wildcard && (wildcard(key.toLowerCase(), modifier.key) || wildcard(currentIdentifier.toLowerCase(), modifier.key))) {
                    // eslint-disable-next-line no-param-reassign
                    copy[key] = modifier.replacement;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign
                    copy[key] = recursiveFilter(copy[key], examinedObjects, saveCopy, [modifier], options, currentIdentifier.toLowerCase());
                }
            }
        }
    }
};

const recursiveFilter = (
    input: unknown,
    examinedObjects: ExaminedObjects[],
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): unknown => {
    if (input === undefined || input === null) {
        return input;
    }

    // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const id: number | undefined = input[circularReferenceKey];

    if (id !== undefined) {
        return examinedObjects[id]?.copy;
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

            if (input.code !== undefined) {
                // @ts-expect-error we handle specific errors that have codes
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                copy.code = input.code;
            }

            const errorKeys = Object.keys(input);

            for (const key of errorKeys) {
                // @ts-expect-error we're literally iterating through attributes, these will exist
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                copy[key] = input[key];
            }

            saveCopy(input, copy);
            recursivelyFilterAttributes(copy as unknown as Record<string, unknown>, examinedObjects, saveCopy, rules, options, identifier);

            return copy;
        }

        if (input instanceof Map) {
            const copy = new Map();
            const iterator = input.entries();

            let result = iterator.next();

            while (!result.done) {
                const [key, value] = result.value as [unknown, unknown];

                if (typeof key === "string" || (typeof key === "object" && key !== null && key.constructor === String)) {
                    let modifierFound = false;

                    for (const modifier of rules) {
                        const lowerCaseKey = key.toLowerCase();

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

            return copy as unknown;
        }

        if (input instanceof Set) {
            const copy = new Set();
            const iterator = input.values();

            let result = iterator.next();

            while (!result.done) {
                copy.add(recursiveFilter(result.value, examinedObjects, saveCopy, rules, options, identifier));

                result = iterator.next();
            }

            saveCopy(input, copy);

            return copy;
        }

        const copy = { ...input };

        saveCopy(input, copy);
        recursivelyFilterAttributes(copy, examinedObjects, saveCopy, rules, options, identifier);

        return copy;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison -- typeof null === "object", so null guard is needed
    if (typeof input === "string" || (typeof input === "object" && input !== null && input.constructor === String)) {
        try {
            const parsed: unknown = JSON.parse(input);

            if (typeof parsed === "object" && parsed !== null) {
                const filtered = recursiveFilter(parsed, examinedObjects, saveCopy, rules, options, identifier);

                return JSON.stringify(filtered);
            }
            // non-object JSON scalars (number/boolean/null/string) fall through to URL/stringAnonymize below
        } catch {
            // not JSON — fall through to URL/stringAnonymize
        }

        // check if it's an url with parameters
        if (urlProtocolRegex.test(input)) {
            const parsedUrlParameters = parseUrlParameters(input);

            const filtered: string[] = [];

            for (const parsedUrlParameter of parsedUrlParameters) {
                const { key, value } = parsedUrlParameter;

                if (key === undefined) {
                    const foundModifier = rules.find((modifier) => modifier.key === value.toLowerCase());

                    if (foundModifier) {
                        filtered.push(String(foundModifier.replacement));
                    } else {
                        filtered.push(value);
                    }
                } else {
                    const foundModifier = rules.find((modifier) => modifier.key === key.toLowerCase());

                    if (foundModifier) {
                        filtered.push(`${key}=${String(foundModifier.replacement)}`);
                    } else {
                        filtered.push(`${key}=${value}`);
                    }
                }
            }

            return filtered.join("");
        }

        return stringAnonymize(input, rules, { logger: options?.logger });
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        saveCopy(input, copy);

        for (const [index, item] of input.entries()) {
            const indexString = index.toString().toLowerCase();
            const currentIdentifier = identifier ? `${identifier}.${indexString}`.toLowerCase() : indexString;
            const foundModifier = rules.find((modifier) => modifier.key === indexString || modifier.key === currentIdentifier);

            if (foundModifier) {
                copy.push(foundModifier.replacement);

                // eslint-disable-next-line no-param-reassign
                identifier = undefined;
            } else {
                copy.push(recursiveFilter(item, examinedObjects, saveCopy, rules, options, currentIdentifier));
            }
        }

        return copy;
    }

    return input;
};

export function redact<V = string>(input: V, rules: Rules, options?: RedactOptions): V;
export function redact<V = Error>(input: V, rules: Rules, options?: RedactOptions): V;
export function redact<V = Record<string, unknown>>(input: V, rules: Rules, options?: RedactOptions): V;
export function redact<V = unknown[]>(input: V, rules: Rules, options?: RedactOptions): V;
export function redact<V = Map<unknown, unknown>>(input: V, rules: Rules, options?: RedactOptions): V;
export function redact<V = Set<unknown>>(input: V, rules: Rules, options?: RedactOptions): V;

// eslint-disable-next-line sonarjs/cognitive-complexity
export function redact<V>(input: V, rules: Rules, options?: RedactOptions): V {
    // eslint-disable-next-line sonarjs/different-types-comparison -- input can be any value at runtime
    if (input === undefined || input === null || typeof input === "number" || typeof input === "boolean") {
        return input;
    }

    const examinedObjects: ExaminedObjects[] = [];

    const saveCopy = (original: unknown, copy: unknown) => {
        const id = examinedObjects.length;

        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
        // eslint-disable-next-line no-param-reassign
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
            const lowerKey = modifier.key.toLowerCase();

            const prepared: InternalAnonymize = {
                ...modifier,
                key: lowerKey,
                replacement: modifier.replacement ?? `<${lowerKey.toUpperCase()}>`,
                wildcard: lowerKey.includes("*") ? true : (modifier as InternalAnonymize).wildcard,
            };

            if (prepared.pattern !== undefined) {
                prepared.compiledPattern = new RegExp(prepared.pattern, "giu");
            }

            preparedModifiers.push(prepared);
        }
    }

    const returnValue = recursiveFilter(input, examinedObjects, saveCopy, preparedModifiers, options) as V;

    for (const examinedObject of examinedObjects) {
        // @ts-expect-error temporarily modifying input objects to avoid infinite recursion
        Reflect.deleteProperty(examinedObject.original, circularReferenceKey);
    }

    return returnValue;
}

export { default as standardRules } from "./rules";
export { default as stringAnonymize } from "./string-anonymizer";
export type { Anonymize, RedactOptions, Rules } from "./types";
