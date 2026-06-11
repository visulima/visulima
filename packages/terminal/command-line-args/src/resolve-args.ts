/* eslint-disable no-underscore-dangle */
import { AlreadySetError, UnknownOptionError, UnknownValueError } from "./errors/index";
import type { ArgumentToken } from "./tokenizer";
import type { CommandLineOptions, OptionDefinition, ParseOptions } from "./types";
import convertValue from "./utils/convert-value";
import debugLog from "./utils/debug";

const CAMEL_CASE_PATTERN = /-([a-z])/g;
const NUMERIC_PATTERN = /^\d+$/;

/**
 * Check if a type is Boolean.
 * @param type The type to check
 * @returns True if the type is Boolean or BooleanConstructor
 */
const isBooleanType = (type: unknown): type is BooleanConstructor => type === Boolean || (typeof type === "function" && type.name === "Boolean");

/**
 * Check if a key is special (starts with underscore).
 * @param key The key to check
 * @returns True if the key starts with underscore (ASCII 95)
 */
const isSpecialKey = (key: string): boolean => key.codePointAt(0) === 95;

/**
 * Append multiple values to array or create new array.
 * @param existingValue The existing value (array or single value)
 * @param newValues
 * @returns Array containing all values
 */
const appendToArrayMultiple = (existingValue: unknown, newValues: unknown[]): unknown[] => {
    if (Array.isArray(existingValue)) {
        return [...existingValue, ...newValues];
    }

    return [existingValue, ...newValues];
};

/**
 * Checks for prototype-polluting keys.
 * Prevents injection of dangerous keys like __proto__, constructor, or prototype.
 * @param key The key to validate
 * @returns True if key is unsafe and should be skipped
 */
const isUnsafeKey = (key: string): boolean => key === "__proto__" || key === "constructor" || key === "prototype";

/**
 * Create or append to array property in object.
 * @param object The object to modify
 * @param key The property key
 * @param value The value to add or assign
 * @param isArray Whether to create an array for this value
 */
const createOrAppendArray = (object: Record<string, unknown>, key: string, value: unknown, isArray: boolean = false): void => {
    if (object[key] === undefined) {
        // eslint-disable-next-line no-param-reassign
        object[key] = isArray ? [value] : value;
    } else if (isArray && Array.isArray(object[key])) {
        object[key].push(value);
    } else {
        // eslint-disable-next-line no-param-reassign
        object[key] = [object[key], value];
    }
};

/**
 * Get option definition by name with optional case-insensitive lookup.
 * @param name The option name to look up
 * @param definitionMap Map of name to definition
 * @param aliasMap Map of alias to definition
 * @param caseInsensitiveNameMap Optional map for case-insensitive name lookup
 * @param caseInsensitiveAliasMap Optional map for case-insensitive alias lookup
 * @returns The matching option definition or undefined
 */
const getDefinition = (
    name: string,
    definitionMap: Map<string, OptionDefinition>,
    aliasMap: Map<string, OptionDefinition>,
    caseInsensitiveNameMap: Map<string, OptionDefinition> | undefined,
    caseInsensitiveAliasMap: Map<string, OptionDefinition> | undefined,
): OptionDefinition | undefined => {
    // Try exact match first (case-sensitive)
    let definition = definitionMap.get(name) ?? aliasMap.get(name);

    // If no exact match and case-insensitive mode is enabled, try lowercase lookup
    if (!definition && caseInsensitiveNameMap) {
        // Normalize the probe key to lowercase before lookups so names and grouped short options
        // are matched correctly (e.g., -AB becomes -ab and matches aliases a and b)
        const lowercasedKey = name.toLowerCase();

        definition = caseInsensitiveNameMap.get(lowercasedKey) ?? caseInsensitiveAliasMap?.get(lowercasedKey);
    }

    return definition;
};

/**
 * Resolved arguments from tokens according to option definitions.
 * Main resolver that converts parsed tokens into final command-line options object.
 * Handles option assignment, value conversion, grouping, defaults, and error detection.
 * @param tokens Array of parsed argument tokens
 * @param definitions Array of option definitions to use for parsing
 * @param options Parsing configuration options
 * @param argv Original command-line arguments for error reporting and unknown args
 * @returns Parsed command-line options object
 * @throws {AlreadySetError} When an option is assigned multiple times in non-multiple mode
 * @throws {UnknownOptionError} When an unknown option is encountered in strict mode
 * @throws {UnknownValueError} When unconsumed positional arguments exist in strict mode
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const resolveArgs = (tokens: ArgumentToken[], definitions: OptionDefinition[], options: ParseOptions, argv: string[]): CommandLineOptions => {
    const debugEnabled = options.debug ?? false;

    debugLog(debugEnabled, `resolveArgs called with options:`, "resolver", {
        partial: options.partial,
        stopAtFirstUnknown: options.stopAtFirstUnknown,
    });
    debugLog(debugEnabled, "Starting argument resolution", "resolver");
    debugLog(debugEnabled, "Tokens:", "resolver", tokens);
    debugLog(debugEnabled, "Definitions:", "resolver", definitions);
    debugLog(debugEnabled, "Processing tokens...", "resolver");

    // Build fast lookup maps - cache for single pass lookups
    const definitionMap = new Map<string, OptionDefinition>();
    const aliasMap = new Map<string, OptionDefinition>();
    const caseInsensitiveNameMap = options.caseInsensitive ? new Map<string, OptionDefinition>() : undefined;
    const caseInsensitiveAliasMap = options.caseInsensitive ? new Map<string, OptionDefinition>() : undefined;
    const camelCaseMap = options.camelCase ? new Map<string, string>() : undefined;
    const camelCaseReverseMap = options.camelCase ? new Map<string, string>() : undefined;

    for (const definition of definitions) {
        definitionMap.set(definition.name, definition);

        if (definition.alias) {
            aliasMap.set(definition.alias, definition);
        }

        if (options.caseInsensitive && caseInsensitiveNameMap) {
            caseInsensitiveNameMap.set(definition.name.toLowerCase(), definition);

            if (definition.alias && caseInsensitiveAliasMap) {
                caseInsensitiveAliasMap.set(definition.alias.toLowerCase(), definition);
            }
        }

        if (options.camelCase && camelCaseMap && camelCaseReverseMap) {
            const camelCase = definition.name.replaceAll(CAMEL_CASE_PATTERN, (_, letter: string) => letter.toUpperCase());

            camelCaseMap.set(definition.name, camelCase);
            camelCaseReverseMap.set(camelCase, definition.name);
        }
    }

    // Use null-prototype accumulators so option names that collide with
    // Object.prototype members (e.g. `toString`, `__proto__`, `constructor`)
    // are treated as plain data keys rather than inherited properties.
    // This fixes two correctness bugs (a `toString` option throwing a false
    // AlreadySetError on first use, a `__proto__` option silently losing its
    // values) and closes a prototype-pollution gap at the same time.
    const output: CommandLineOptions = Object.create(null) as CommandLineOptions;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: Record<string, any> = Object.create(null) as Record<string, any>;
    const unknownArgs: { index: number; value: string }[] = [];
    const unknownTokenIndexEntries: { index: number; value: string }[] = [];
    const consumedPositionalIndices = new Set<number>();
    let stoppedByTerminator = false;

    const defaultOptionDefinition = definitions.find((d) => d.defaultOption);
    const hasGroups = definitions.some((d) => d.group);
    // Precompute the first Number-typed definition once instead of re-scanning
    // `definitions` for every numeric token encountered in the loop below.
    const numberTypedDefinition = definitions.find((d) => d.type === Number);

    // Single optimized pass through tokens
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i] as ArgumentToken;

        if (token.kind === "option-terminator") {
            output._unknown = argv.slice(token.index);
            stoppedByTerminator = true;
            break;
        }

        if (token.kind === "option" && token.name) {
            // Fast lookup for option definition
            let definition = getDefinition(token.name, definitionMap, aliasMap, caseInsensitiveNameMap, caseInsensitiveAliasMap);

            // Handle numeric option names
            if (!definition && token.value === undefined && numberTypedDefinition && NUMERIC_PATTERN.test(token.name)) {
                definition = numberTypedDefinition;
                token.value = token.name;
                token.name = numberTypedDefinition.name;
            }

            // Handle `--no-<flag>` boolean negation (opt-in via `negation`).
            // Only long-option tokens without an inline value qualify; the base
            // option must resolve to a Boolean-typed definition.
            let negated = false;

            if (!definition && options.negation && token.value === undefined && token.name.startsWith("no-")) {
                const baseName = token.name.slice(3);
                const baseDefinition = getDefinition(baseName, definitionMap, aliasMap, caseInsensitiveNameMap, caseInsensitiveAliasMap);

                if (baseDefinition?.type && isBooleanType(baseDefinition.type)) {
                    definition = baseDefinition;
                    negated = true;
                }
            }

            const optionName = definition ? definition.name : token.name;
            const isMultiple = definition?.multiple;
            const isLazyMultiple = definition?.lazyMultiple;

            if (Object.hasOwn(values, optionName) && values[optionName] !== undefined && !isMultiple && !isLazyMultiple && !options.partial) {
                throw new AlreadySetError(optionName);
            }

            if (!definition && options.partial) {
                const rawArgument = token.rawName ?? `--${token.name}${token.value !== undefined && token.inlineValue ? `=${token.value}` : ""}`;

                unknownArgs.push({ index: token.index, value: rawArgument });
                continue;
            }

            if (!definition && options.stopAtFirstUnknown) {
                output._unknown = argv.slice(token.index);
                break;
            }

            if (!definition && !options.partial) {
                throw new UnknownOptionError(token.name);
            }

            if (token.value === undefined) {
                const nextToken = tokens[i + 1];
                // Check if next token is a value-only option token (from short option groups like -ab=value)
                const isValueOnlyOptionToken = nextToken?.kind === "option" && !("name" in nextToken) && nextToken.value !== undefined;
                const shouldConsumeValue =
                    nextToken &&
                    definition &&
                    !(definition.type && isBooleanType(definition.type)) &&
                    (nextToken.kind === "positional" || isValueOnlyOptionToken);
                const isDefaultOptionNonMultiple = definition && definition.defaultOption && !definition.multiple && !definition.lazyMultiple;

                if (shouldConsumeValue && (!definition?.defaultOption || isDefaultOptionNonMultiple)) {
                    if (isMultiple) {
                        let currentIndex = i + 1;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const collectedValues: any[] = [];

                        while (
                            currentIndex < tokens.length &&
                            ((tokens[currentIndex] as ArgumentToken).kind === "positional" ||
                                ((tokens[currentIndex] as ArgumentToken).kind === "option" &&
                                    !("name" in (tokens[currentIndex] as ArgumentToken)) &&
                                    (tokens[currentIndex] as ArgumentToken).value !== undefined))
                        ) {
                            collectedValues.push((tokens[currentIndex] as ArgumentToken).value);
                            consumedPositionalIndices.add((tokens[currentIndex] as ArgumentToken).index);
                            // eslint-disable-next-line no-plusplus
                            currentIndex++;
                        }

                        values[optionName] = values[optionName] === undefined ? collectedValues : appendToArrayMultiple(values[optionName], collectedValues);

                        // eslint-disable-next-line sonarjs/updated-loop-counter
                        i = currentIndex - 1;
                    } else if (isLazyMultiple) {
                        createOrAppendArray(values, optionName, nextToken.value, true);
                        consumedPositionalIndices.add(nextToken.index);
                        // eslint-disable-next-line no-plusplus
                        i++;
                    } else {
                        values[optionName] = nextToken.value;
                        consumedPositionalIndices.add(nextToken.index);
                        // eslint-disable-next-line no-plusplus
                        i++;
                    }
                } else if (definition?.type && isBooleanType(definition.type)) {
                    createOrAppendArray(values, optionName, !negated, isMultiple);
                } else {
                    // eslint-disable-next-line unicorn/no-null
                    values[optionName] = isMultiple ? [] : null;
                }
            } else {
                // Option with inline value
                let { value } = token as Omit<ArgumentToken, "value"> & { value: string | boolean };

                if (definition?.type && isBooleanType(definition.type)) {
                    switch (value) {
                        case "": {
                            if (options.partial) {
                                values._unknown ??= [];

                                const rawUnknown = `${token.rawName ?? `--${token.name}`}${token.value ? `=${token.value}` : ""}`;

                                (values._unknown as string[]).push(rawUnknown);
                                unknownTokenIndexEntries.push({ index: token.index, value: rawUnknown });
                                value = true;
                            } else {
                                throw new UnknownOptionError(token.name);
                            }

                            break;
                        }
                        case "false": {
                            value = false;
                            break;
                        }
                        case "true": {
                            value = true;
                            break;
                        }
                        default: {
                            value = true;
                        }
                    }
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const collectedValues: any[] = [value];

                if (isMultiple) {
                    let currentIndex = i + 1;

                    while (currentIndex < tokens.length && (tokens[currentIndex] as ArgumentToken).kind === "positional") {
                        collectedValues.push((tokens[currentIndex] as ArgumentToken).value);
                        consumedPositionalIndices.add((tokens[currentIndex] as ArgumentToken).index);
                        // eslint-disable-next-line no-plusplus
                        currentIndex++;
                    }

                    // eslint-disable-next-line sonarjs/updated-loop-counter
                    i = currentIndex - 1;
                }

                if (values[optionName] === undefined) {
                    values[optionName] = isMultiple || isLazyMultiple ? collectedValues : value;
                } else if (isMultiple || isLazyMultiple) {
                    values[optionName] = appendToArrayMultiple(values[optionName], collectedValues);
                } else {
                    values[optionName] = value;
                }
            }
        } else if (token.kind === "positional" && options.stopAtFirstUnknown && !consumedPositionalIndices.has(token.index) && !defaultOptionDefinition) {
            // Only stop on unconsumed positionals when there is no defaultOption to absorb them.
            // When a defaultOption exists, positionals are collected in the second pass below.
            debugLog(debugEnabled, `Found unconsumed positional token at index ${String(token.index)}, stopping processing`, "resolver");
            output._unknown = argv.slice(token.index);
            break;
        }
    }

    // Ensure multiple values are arrays

    for (const [key, value] of Object.entries(values)) {
        const definition = definitionMap.get(key);

        if (definition && (definition.multiple || definition.lazyMultiple) && !Array.isArray(value)) {
            values[key] = [value];
        }
    }

    // Shared predicate: does this token reference an option not present in any
    // definition/alias map (honouring case-insensitive lookups)?
    const isUnknownOptionToken = (token: ArgumentToken): boolean =>
        token.kind === "option" &&
        !definitionMap.has(token.name ?? "") &&
        !aliasMap.has(token.name ?? "") &&
        (!options.caseInsensitive ||
            (!caseInsensitiveNameMap?.has(token.name?.toLowerCase() ?? "") && !caseInsensitiveAliasMap?.has(token.name?.toLowerCase() ?? "")));

    // When stopAtFirstUnknown is set, locate the first truly unknown option once
    // and reuse the result for both the defaultOption cut-off (argv index) and the
    // final _unknown slice (token-array index) below.
    let firstUnknownOptionTokenIndex = -1;
    let stopAtUnknownArgvIndex = Number.POSITIVE_INFINITY;

    if (options.stopAtFirstUnknown && !stoppedByTerminator) {
        firstUnknownOptionTokenIndex = tokens.findIndex((token) => isUnknownOptionToken(token));

        if (firstUnknownOptionTokenIndex !== -1) {
            stopAtUnknownArgvIndex = (tokens[firstUnknownOptionTokenIndex] as ArgumentToken).index;
        }
    }

    // Handle defaultOption
    if (defaultOptionDefinition) {
        const positionalValues: unknown[] = [];
        const positionalTokens: ArgumentToken[] = [];

        for (const token of tokens) {
            // Only consume positionals that appear before any unknown option
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index) && token.index < stopAtUnknownArgvIndex) {
                positionalValues.push(token.value);
                positionalTokens.push(token);
            }
        }

        if (positionalValues.length > 0) {
            const existingValue: unknown = values[defaultOptionDefinition.name];
            const isMultiple = defaultOptionDefinition.multiple ?? defaultOptionDefinition.lazyMultiple;

            if (existingValue === undefined) {
                if (isMultiple) {
                    positionalTokens.forEach((token) => consumedPositionalIndices.add(token.index));
                    values[defaultOptionDefinition.name] = positionalValues;
                } else {
                    consumedPositionalIndices.add((positionalTokens[0] as ArgumentToken).index);
                    // eslint-disable-next-line prefer-destructuring
                    values[defaultOptionDefinition.name] = positionalValues[0];
                }
            } else if (isMultiple) {
                positionalTokens.forEach((token) => consumedPositionalIndices.add(token.index));
                values[defaultOptionDefinition.name] = Array.isArray(existingValue)
                    ? [...positionalValues, ...existingValue]
                    : [...positionalValues, existingValue];
            }
        }
    }

    // In non-partial mode, throw error for unconsumed positional arguments
    if (!options.partial) {
        for (const token of tokens) {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                throw new UnknownValueError(argv[token.index] as string);
            }
        }
    }

    // In partial mode, collect remaining unconsumed positional arguments as unknown
    if (options.partial && !options.stopAtFirstUnknown) {
        const allUnknownItems: { index: number; value: string }[] = [...unknownArgs];

        if (values._unknown) {
            for (const entry of unknownTokenIndexEntries) {
                allUnknownItems.push({ index: entry.index, value: entry.value });
            }
        }

        for (const token of tokens) {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                allUnknownItems.push({ index: token.index, value: argv[token.index] as string });
            }
        }

        if (allUnknownItems.length > 0) {
            allUnknownItems.sort((a, b) => a.index - b.index);
            output._unknown = allUnknownItems.map((item) => item.value);
        }
    }

    // Handle stopAtFirstUnknown (reuses firstUnknownOptionTokenIndex from above)
    if (options.stopAtFirstUnknown && !stoppedByTerminator) {
        const firstUnconsumedPositionalTokenIndex = tokens.findIndex((token) => token.kind === "positional" && !consumedPositionalIndices.has(token.index));

        let firstTokenIndex = -1;

        if (firstUnknownOptionTokenIndex !== -1 && firstUnconsumedPositionalTokenIndex !== -1) {
            firstTokenIndex = Math.min(firstUnknownOptionTokenIndex, firstUnconsumedPositionalTokenIndex);
        } else if (firstUnknownOptionTokenIndex !== -1) {
            firstTokenIndex = firstUnknownOptionTokenIndex;
        } else if (firstUnconsumedPositionalTokenIndex !== -1) {
            firstTokenIndex = firstUnconsumedPositionalTokenIndex;
        }

        if (firstTokenIndex >= 0) {
            // Use the token's index field (actual argv index) instead of token array index
            const argvIndex = (tokens[firstTokenIndex] as ArgumentToken).index;

            output._unknown = argv.slice(argvIndex);
        }
    } else if (unknownArgs.length > 0 && !options.partial) {
        output._unknown = unknownArgs.map((item) => item.value);
    }

    // Process collected values

    for (const [key, value] of Object.entries(values)) {
        const finalKey = options.camelCase ? (camelCaseMap?.get(key) ?? key) : key;
        const definition = definitionMap.get(key);

        if (definition?.type) {
            output[finalKey] = convertValue(value, definition.type, { optionName: definition.name, strictTypes: options.strictTypes });
        } else {
            // eslint-disable-next-line unicorn/no-null, @typescript-eslint/no-unsafe-assignment
            output[finalKey] = value === undefined ? null : value;
        }
    }

    // Handle default values

    for (const definition of definitions) {
        const key = options.camelCase ? (camelCaseMap?.get(definition.name) ?? definition.name) : definition.name;

        if (!(key in output) && definition.defaultValue !== undefined) {
            const isMultipleDefinition = definition.multiple ?? definition.lazyMultiple;

            if (isMultipleDefinition) {
                output[key] = Array.isArray(definition.defaultValue) ? [...definition.defaultValue] : [definition.defaultValue];
            } else {
                output[key] = definition.defaultValue;
            }
        }
    }

    // Handle grouping
    if (hasGroups) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groups: Record<string, Record<string, any>> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allOptions: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ungroupedOptions: Record<string, any> = {};

        for (const definition of definitions) {
            if (definition.group) {
                const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                for (const group of groupArray) {
                    if (isUnsafeKey(group)) {
                        continue;
                    }

                    groups[group] ??= {};
                }
            }
        }

        for (const key of Object.keys(output)) {
            if (!isSpecialKey(key)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                allOptions[key] = output[key];

                let originalKey = key;

                if (options.camelCase) {
                    originalKey = camelCaseReverseMap?.get(key) ?? key;
                }

                const definition = definitionMap.get(originalKey);

                if (definition?.group) {
                    const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                    for (const group of groupArray) {
                        if (isUnsafeKey(group)) {
                            continue;
                        }

                        if (groups[group]) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            groups[group][key] = output[key];
                        }
                    }
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    ungroupedOptions[key] = output[key];
                }
            }
        }

        const groupedOutput: CommandLineOptions = { _all: allOptions };

        for (const [group, groupOptions] of Object.entries(groups)) {
            groupedOutput[group] = groupOptions;
        }

        if (Object.keys(ungroupedOptions).length > 0) {
            groupedOutput._none = ungroupedOptions;
        }

        if (output._unknown) {
            groupedOutput._unknown = output._unknown;
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        Object.keys(output).forEach((key) => delete output[key]);
        Object.assign(output, groupedOutput);
    }

    // Normalize the null-prototype accumulator back to an ordinary object so the
    // public result has the expected Object prototype (instanceof / toStrictEqual /
    // structuredClone all behave as callers expect). Use property descriptors
    // rather than Object.assign so own keys that collide with Object.prototype
    // members (e.g. `toString`, `__proto__`) survive as plain data properties
    // instead of triggering inherited setters.
    const result = Object.defineProperties({}, Object.getOwnPropertyDescriptors(output)) as CommandLineOptions;

    debugLog(debugEnabled, "Final parsed result:", "resolver", result);

    return result;
};

export default resolveArgs;
