// eslint-disable-next-line import/no-extraneous-dependencies,e18e/ban-dependencies
import { deleteProperty, getProperty, hasProperty, setProperty } from "dot-prop";

import stringAnonymize from "./string-anonymizer";
import type { Censor, InternalAnonymize, RedactOptions, Rules } from "./types";
import parseUrlParameters from "./utils/parse-url-parameters";
import wildcard from "./utils/wildcard";

type SaveCopy = (original: object, copy: unknown) => void;

const urlProtocolRegex = /(?:http|https):\/\/?/;

/**
 * Resolve a rule's replacement against the matched value. A function replacement
 * (a {@link Censor}) is invoked with the original value and dot-path; a static
 * replacement is returned as-is.
 */
const resolveReplacement = (modifier: InternalAnonymize, value: unknown, path: string | undefined): unknown => {
    if (typeof modifier.replacement === "function") {
        return (modifier.replacement as Censor)(value, path);
    }

    return modifier.replacement;
};

const recursivelyFilterAttributes = (
    copy: Record<string, unknown>,
    examinedObjects: WeakMap<object, unknown>,
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): void => {
    for (const modifier of rules) {
        // Fast direct (possibly dotted) path match for plain rules: a non-wildcard, non-deep rule
        // whose key resolves on this node is applied here and does NOT recurse, so a more specific
        // dotted rule (e.g. "user.password") is never overridden by a broad key rule.
        if (!modifier.wildcard && !modifier.deep && hasProperty(copy, modifier.key)) {
            if (modifier.remove) {
                deleteProperty(copy, modifier.key);
            } else {
                setProperty(copy, modifier.key, resolveReplacement(modifier, getProperty(copy, modifier.key), modifier.key));
            }
        } else {
            const keys = Object.keys(copy);

            for (const key of keys) {
                const lowerKey = key.toLowerCase();
                const currentIdentifier = identifier ? `${identifier}.${lowerKey}` : lowerKey;

                if (
                    (!modifier.wildcard && lowerKey === modifier.key)
                    || (modifier.wildcard && (wildcard(lowerKey, modifier.key) || wildcard(currentIdentifier, modifier.key)))
                ) {
                    if (modifier.remove) {
                        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-dynamic-delete
                        delete copy[key];
                    } else {
                        // eslint-disable-next-line no-param-reassign
                        copy[key] = resolveReplacement(modifier, copy[key], currentIdentifier);
                    }
                } else if (Object.hasOwn(copy, key)) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign
                    copy[key] = recursiveFilter(copy[key], examinedObjects, saveCopy, [modifier], options, currentIdentifier);
                }
            }
        }
    }
};

// Find the rule whose key matches a url segment name — honouring exact AND wildcard rules so a
// `*token*` rule that works on object keys also matches `?access_token=...` query strings.
const findUrlModifier = (rules: InternalAnonymize[], name: string): InternalAnonymize | undefined => {
    const lowerName = name.toLowerCase();

    return rules.find((modifier) => modifier.key === lowerName || (Boolean(modifier.wildcard) && wildcard(lowerName, modifier.key)));
};

const filterUrl = (input: string, rules: InternalAnonymize[]): string => {
    const parsedUrlParameters = parseUrlParameters(input);
    const filtered: string[] = [];

    for (const parsedUrlParameter of parsedUrlParameters) {
        const { key, value } = parsedUrlParameter;

        if (key === undefined) {
            const foundModifier = findUrlModifier(rules, value);

            filtered.push(foundModifier ? String(resolveReplacement(foundModifier, value, undefined)) : value);
        } else {
            const foundModifier = findUrlModifier(rules, key);

            if (foundModifier) {
                filtered.push(`${key}=${String(resolveReplacement(foundModifier, value, undefined))}`);
            } else {
                filtered.push(`${key}=${value}`);
            }
        }
    }

    return filtered.join("");
};

const recursiveFilter = (
    input: unknown,
    examinedObjects: WeakMap<object, unknown>,
    saveCopy: SaveCopy,
    rules: InternalAnonymize[],
    options?: RedactOptions,
    identifier?: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): unknown => {
    if (input === undefined || input === null) {
        return input;
    }

    // Circular-reference tracking via a WeakMap keyed on the original object — this never
    // mutates caller inputs (so frozen/sealed objects are safe and nothing leaks on throw).
    if (typeof input === "object" && examinedObjects.has(input)) {
        return examinedObjects.get(input);
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

            saveCopy(input, copy);

            const iterator = input.entries();

            let result = iterator.next();

            while (!result.done) {
                const [key, value] = result.value as [unknown, unknown];

                if (typeof key === "string" || (typeof key === "object" && key !== null && key.constructor === String)) {
                    let matchedModifier: InternalAnonymize | undefined;
                    const lowerCaseKey = key.toLowerCase();

                    for (const modifier of rules) {
                        if (modifier.key === lowerCaseKey || (modifier.wildcard && wildcard(lowerCaseKey, modifier.key))) {
                            matchedModifier = modifier;

                            break;
                        }
                    }

                    if (matchedModifier) {
                        if (!matchedModifier.remove) {
                            copy.set(key, resolveReplacement(matchedModifier, value, lowerCaseKey));
                        }
                    } else {
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

            return copy as unknown;
        }

        if (input instanceof Set) {
            const copy = new Set();

            saveCopy(input, copy);

            const iterator = input.values();

            let result = iterator.next();

            while (!result.done) {
                copy.add(recursiveFilter(result.value, examinedObjects, saveCopy, rules, options, identifier));

                result = iterator.next();
            }

            return copy;
        }

        const copy = { ...input };

        saveCopy(input, copy);
        recursivelyFilterAttributes(copy, examinedObjects, saveCopy, rules, options, identifier);

        return copy;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison -- typeof null === "object", so null guard is needed
    if (typeof input === "string" || (typeof input === "object" && input !== null && input.constructor === String)) {
        // A boxed `String` object must be coerced to a primitive before regex/JSON handling.
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const stringInput = typeof input === "string" ? input : input.toString();

        try {
            const parsed: unknown = JSON.parse(stringInput);

            if (typeof parsed === "object" && parsed !== null) {
                const filtered = recursiveFilter(parsed, examinedObjects, saveCopy, rules, options, identifier);

                return JSON.stringify(filtered);
            }
            // non-object JSON scalars (number/boolean/null/string) fall through to URL/stringAnonymize below
        } catch {
            // not JSON — fall through to URL/stringAnonymize
        }

        // check if it's an url with parameters
        if (urlProtocolRegex.test(stringInput)) {
            return filterUrl(stringInput, rules);
        }

        return stringAnonymize(stringInput, rules, { logger: options?.logger });
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        saveCopy(input, copy);

        for (const [index, item] of input.entries()) {
            const indexString = index.toString().toLowerCase();
            const currentIdentifier = identifier ? `${identifier}.${indexString}`.toLowerCase() : indexString;
            const foundModifier = rules.find((modifier) => modifier.key === indexString || modifier.key === currentIdentifier);

            if (foundModifier) {
                copy.push(resolveReplacement(foundModifier, item, currentIdentifier));

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

/**
 * Pre-compile a rule set into the internal modifier representation: keys are lowercased,
 * default `&lt;KEY&gt;` replacements are filled in, wildcards are detected, and string
 * `pattern`s are compiled to `RegExp` once. Done a single time per {@link createRedactor}
 * (or per {@link redact} call) instead of on every traversal.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const prepareModifiers = (rules: Rules, options?: RedactOptions): InternalAnonymize[] => {
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

            preparedModifiers.push({ deep: false, key: modifier.toLowerCase(), replacement: `<${modifier.toUpperCase()}>`, userReplacement: false, wildcard: hasWildcard });
        } else if (typeof modifier === "number") {
            preparedModifiers.push({ deep: false, key: modifier.toString(), replacement: "<REDACTED>" });
        } else {
            const lowerKey = modifier.key.toLowerCase();

            const prepared: InternalAnonymize = {
                ...modifier,
                key: lowerKey,
                // A function replacement (censor) is kept as-is; only fill the default for nullish.
                replacement: modifier.replacement ?? `<${lowerKey.toUpperCase()}>`,
                // Track whether the user supplied an explicit replacement so the string-anonymizer
                // can keep its numbered "TAG"/"TAG1" masks for default (auto-filled) rules.
                userReplacement: modifier.replacement !== undefined,
                wildcard: lowerKey.includes("*") ? true : (modifier as InternalAnonymize).wildcard,
            };

            if (prepared.pattern !== undefined) {
                prepared.compiledPattern = prepared.pattern instanceof RegExp ? prepared.pattern : new RegExp(prepared.pattern, "giu");
            }

            preparedModifiers.push(prepared);
        }
    }

    return preparedModifiers;
};

const runRedact = <V>(input: V, preparedModifiers: InternalAnonymize[], options?: RedactOptions): V => {
    // eslint-disable-next-line sonarjs/different-types-comparison -- input can be any value at runtime
    if (input === undefined || input === null || typeof input === "number" || typeof input === "boolean") {
        return input;
    }

    // WeakMap maps each visited original object to its copy. It never mutates the input and
    // is garbage-collected automatically, so no cleanup pass is required and nothing leaks if
    // a rule throws mid-walk.
    const examinedObjects = new WeakMap<object, unknown>();

    const saveCopy: SaveCopy = (original, copy) => {
        examinedObjects.set(original, copy);
    };

    return recursiveFilter(input, examinedObjects, saveCopy, preparedModifiers, options) as V;
};

/**
 * Deep-copies the input and masks sensitive values according to `rules`. Objects, arrays,
 * `Error`s, `Map`s, `Set`s, JSON strings and URL query strings are all traversed. The input
 * is never mutated, and circular references are handled.
 * @example
 * ```ts
 * import { redact, standardRules } from "@visulima/redact";
 *
 * redact({ password: "hunter2", user: "alice" }, ["password"]);
 * // => { password: "<PASSWORD>", user: "alice" }
 *
 * // partial masking with a censor function:
 * redact({ card: "4111111111111111" }, [
 *     { key: "card", replacement: (value) => `****${String(value).slice(-4)}` },
 * ]);
 * // => { card: "****1111" }
 *
 * // remove a key entirely:
 * redact({ secret: "x", keep: 1 }, [{ key: "secret", remove: true }]);
 * // => { keep: 1 }
 * ```
 * @template V The type of the input value; the return type mirrors it.
 * @param input The value to redact. Returned unchanged for `null`/`undefined`/`number`/`boolean`.
 * @param rules An array of rules: key names (`string`), array indices (`number`), wildcard
 * patterns (`"*token*"`), or `Anonymize`/`StringAnonymize` objects with
 * `pattern`/`replacement`/`remove`.
 * @param options Optional settings — `exclude` to drop rules by key, and `logger.debug` for tracing.
 * @returns A redacted deep copy of `input`.
 */
export const redact = <V>(input: V, rules: Rules, options?: RedactOptions): V => {
    const preparedModifiers = prepareModifiers(rules, options);

    return runRedact(input, preparedModifiers, options);
};

/**
 * Compiles `rules` once and returns a reusable redactor function. Prefer this over calling
 * {@link redact} repeatedly with the same rule set (e.g. in a logger), since it avoids
 * re-lowercasing keys and re-compiling patterns on every call.
 * @example
 * ```ts
 * import { createRedactor, standardRules } from "@visulima/redact";
 *
 * const scrub = createRedactor(standardRules);
 * logger.info(scrub(payload));
 * ```
 * @param rules The rule set to compile.
 * @param options Optional settings applied at compile time (`exclude`) and per call (`logger`).
 * @returns A function `(input) => redactedCopy`.
 */
export const createRedactor = (rules: Rules, options?: RedactOptions): (<V>(input: V) => V) => {
    const preparedModifiers = prepareModifiers(rules, options);

    return <V>(input: V): V => runRedact(input, preparedModifiers, options);
};

export { credentialRules, dateTimeRules, piiRules, default as standardRules } from "./rules";
export { default as stringAnonymize } from "./string-anonymizer";
export type { Anonymize, Censor, RedactOptions, Rules, StringAnonymize } from "./types";
