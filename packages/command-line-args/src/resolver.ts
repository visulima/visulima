import debugLog from "./debug";
import { AlreadySetError, UnknownOptionError, UnknownValueError } from "./errors/index";
import type { CommandLineOptions, OptionDefinition, ParseOptions } from "./index";
import type { ArgToken as ArgumentToken } from "./tokenizer";
import convertValue from "./type-conversion";

const CAMEL_CASE_PATTERN = /-([a-z])/g;

/**
 * Check if a type is Boolean.
 * @param type The type to check
 * @returns True if the type is Boolean or BooleanConstructor
 */
const isBooleanType = (type: unknown): type is BooleanConstructor => type === Boolean || (typeof type === "function" && type.name?.startsWith("Boolean"));

/**
 * Check if a key is special (starts with underscore).
 * @param key The key to check
 * @returns True if the key starts with underscore (ASCII 95)
 */
const isSpecialKey = (key: string): boolean => key.charCodeAt(0) === 95;

/**
 * Append multiple values to array or create new array.
 * @param existingValue The existing value (array or single value)
 * @param newValues The new values to append
 * @returns Array containing all values
 */
const appendToArrayMultiple = (existingValue: unknown, newValues: unknown[]): unknown[] => {
    if (Array.isArray(existingValue)) {
        existingValue.push(...newValues);

        return existingValue;
    }

    return [existingValue, ...newValues];
};

/**
 * Create or append to array property in object.
 * @param object The object to modify
 * @param key The property key
 * @param value The value to add or assign
 * @param isArray Whether to create an array for this value
 */
const createOrAppendArray = (object: Record<string, unknown>, key: string, value: unknown, isArray: boolean = false): void => {
    if (object[key] === undefined) {
        object[key] = isArray ? [value] : value;
    } else if (isArray && Array.isArray(object[key])) {
        object[key].push(value);
    } else {
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
    caseInsensitiveNameMap: Map<string, OptionDefinition> | null,
    caseInsensitiveAliasMap: Map<string, OptionDefinition> | null,
): OptionDefinition | undefined => {
    let definition = definitionMap.get(name) || aliasMap.get(name);

    if (!definition && caseInsensitiveNameMap) {
        definition = caseInsensitiveNameMap.get(name) || caseInsensitiveAliasMap!.get(name);
    }

    return definition;
};

/**
 * Resolved arguments from tokens according to option definitions.
 */
export const resolveArgs = (tokens: ArgumentToken[], definitions: OptionDefinition[], options: ParseOptions, argv: string[]): CommandLineOptions => {
    const debugEnabled = options.debug || false;

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
    const caseInsensitiveNameMap = options.caseInsensitive ? new Map<string, OptionDefinition>() : null;
    const caseInsensitiveAliasMap = options.caseInsensitive ? new Map<string, OptionDefinition>() : null;
    const camelCaseMap = options.camelCase ? new Map<string, string>() : null;
    const camelCaseReverseMap = options.camelCase ? new Map<string, string>() : null;

    for (const definition of definitions) {
        definitionMap.set(definition.name, definition);

        if (definition.alias) {
            aliasMap.set(definition.alias, definition);
        }

        if (options.caseInsensitive) {
            caseInsensitiveNameMap!.set(definition.name.toLowerCase(), definition);

            if (definition.alias) {
                caseInsensitiveAliasMap!.set(definition.alias.toLowerCase(), definition);
            }
        }

        if (options.camelCase) {
            const camelCase = definition.name.replaceAll(CAMEL_CASE_PATTERN, (_, letter) => letter.toUpperCase());

            camelCaseMap!.set(definition.name, camelCase);
            camelCaseReverseMap!.set(camelCase, definition.name);
        }
    }

    const output: CommandLineOptions = {};
    const values: Record<string, any> = {};
    const unknownArgs: { index: number; value: string }[] = [];
    const consumedPositionalIndices = new Set<number>();
    let stoppedByTerminator = false;

    const defaultOptionDefinition = definitions.find((d) => d.defaultOption);
    const hasGroups = definitions.some((d) => d.group);
    const hasNumberType = definitions.some((d) => d.type === Number);

    // Single optimized pass through tokens
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.kind === "option-terminator") {
            output._unknown = argv.slice(token.index);
            stoppedByTerminator = true;
            break;
        }

        if (token.kind === "option" && token.name) {
            // Fast lookup for option definition
            let definition = getDefinition(token.name, definitionMap, aliasMap, caseInsensitiveNameMap, caseInsensitiveAliasMap);

            // Handle numeric option names
            if (!definition && token.value === undefined && hasNumberType && /^\d+$/.test(token.name)) {
                const numberDefinition = definitions.find((def) => def.type === Number);

                if (numberDefinition) {
                    definition = numberDefinition;
                    (token as any).value = token.name;
                    (token as any).name = numberDefinition.name;
                }
            }

            const optionName = definition ? definition.name : token.name;
            const isMultiple = definition && definition.multiple;
            const isLazyMultiple = definition && definition.lazyMultiple;

            if (values[optionName] !== undefined && !isMultiple && !isLazyMultiple && !options.partial) {
                throw new AlreadySetError(optionName);
            }

            if (!definition && options.partial) {
                const rawArgument = token.rawName || `--${token.name}${token.value !== undefined && token.inlineValue ? `=${token.value}` : ""}`;

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
                const shouldConsumeValue = nextToken && nextToken.kind === "positional" && definition && !(definition.type && isBooleanType(definition.type));
                const isDefaultOptionNonMultiple = definition && definition.defaultOption && !definition.multiple && !definition.lazyMultiple;

                if (shouldConsumeValue && (!definition?.defaultOption || isDefaultOptionNonMultiple)) {
                    if (isMultiple) {
                        let currentIndex = i + 1;
                        const collectedValues: any[] = [];

                        while (currentIndex < tokens.length && tokens[currentIndex].kind === "positional") {
                            collectedValues.push(tokens[currentIndex].value);
                            consumedPositionalIndices.add(tokens[currentIndex].index);
                            currentIndex++;
                        }

                        values[optionName] = values[optionName] === undefined ? collectedValues : appendToArrayMultiple(values[optionName], collectedValues);

                        i = currentIndex - 1;
                    } else if (isLazyMultiple) {
                        createOrAppendArray(values, optionName, nextToken.value, true);
                        consumedPositionalIndices.add(nextToken.index);
                        i++;
                    } else {
                        values[optionName] = nextToken.value;
                        consumedPositionalIndices.add(nextToken.index);
                        i++;
                    }
                } else if (definition && definition.type && isBooleanType(definition.type)) {
                    createOrAppendArray(values, optionName, true, isMultiple);
                } else {
                    values[optionName] = isMultiple ? [] : null;
                }
            } else {
                // Option with inline value
                let { value } = token;

                if (definition && definition.type && isBooleanType(definition.type)) {
                    switch (value) {
                        case "": {
                            if (options.partial) {
                                if (!values._unknown) {
                                    values._unknown = [];
                                }

                                values._unknown.push(`${token.rawName || `--${token.name}`}${token.value ? `=${token.value}` : ""}`);
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

                const collectedValues: any[] = value === undefined ? [] : [value];

                if (isMultiple) {
                    let currentIndex = i + 1;

                    while (currentIndex < tokens.length && tokens[currentIndex].kind === "positional") {
                        collectedValues.push(tokens[currentIndex].value);
                        consumedPositionalIndices.add(tokens[currentIndex].index);
                        currentIndex++;
                    }
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
        } else if (token.kind === "positional" && options.stopAtFirstUnknown && !consumedPositionalIndices.has(token.index)) {
            debugLog(debugEnabled, `Found unconsumed positional token at index ${token.index}, stopping processing`, "resolver");
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

    // Handle defaultOption
    if (defaultOptionDefinition) {
        const positionalValues: any[] = [];
        const positionalTokens: ArgumentToken[] = [];

        for (const token of tokens) {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                positionalValues.push(token.value);
                positionalTokens.push(token);
            }
        }

        if (positionalValues.length > 0) {
            const existingValue = values[defaultOptionDefinition.name];
            const isMultiple = defaultOptionDefinition.multiple || defaultOptionDefinition.lazyMultiple;

            if (existingValue === undefined) {
                if (isMultiple) {
                    positionalTokens.forEach((token) => consumedPositionalIndices.add(token.index));
                    values[defaultOptionDefinition.name] = positionalValues;
                } else {
                    consumedPositionalIndices.add(positionalTokens[0].index);
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
                throw new UnknownValueError(argv[token.index]);
            }
        }
    }

    // In partial mode, collect remaining unconsumed positional arguments as unknown
    if (options.partial && !options.stopAtFirstUnknown) {
        const allUnknownItems: { index: number; value: string }[] = [...unknownArgs];

        if (values._unknown) {
            const valueUnknownMap = new Map<string, number>();

            for (const [i, element] of argv.entries()) {
                valueUnknownMap.set(element, i);
            }

            for (const argument of values._unknown) {
                const index = valueUnknownMap.get(argument);

                if (index !== undefined) {
                    allUnknownItems.push({ index, value: argument });
                }
            }
        }

        for (const token of tokens) {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                allUnknownItems.push({ index: token.index, value: argv[token.index] });
            }
        }

        if (allUnknownItems.length > 0) {
            allUnknownItems.sort((a, b) => a.index - b.index);
            output._unknown = allUnknownItems.map((item) => item.value);
        }
    }

    // Handle stopAtFirstUnknown
    if (options.stopAtFirstUnknown && !stoppedByTerminator) {
        const firstUnknownOptionIndex = tokens.findIndex(
            (token) =>
                token.kind === "option"
                && !definitionMap.has(token.name || "")
                && !aliasMap.has(token.name || "")
                && (!options.caseInsensitive
                    || (!caseInsensitiveNameMap?.has(token.name?.toLowerCase() || "") && !caseInsensitiveAliasMap?.has(token.name?.toLowerCase() || ""))),
        );

        const firstUnconsumedPositionalIndex = tokens.findIndex((token) => token.kind === "positional" && !consumedPositionalIndices.has(token.index));

        let firstUnknownIndex = -1;

        if (firstUnknownOptionIndex !== -1 && firstUnconsumedPositionalIndex !== -1) {
            firstUnknownIndex = Math.min(firstUnknownOptionIndex, firstUnconsumedPositionalIndex);
        } else if (firstUnknownOptionIndex !== -1) {
            firstUnknownIndex = firstUnknownOptionIndex;
        } else if (firstUnconsumedPositionalIndex !== -1) {
            firstUnknownIndex = firstUnconsumedPositionalIndex;
        }

        if (firstUnknownIndex >= 0) {
            output._unknown = argv.slice(firstUnknownIndex);
        }
    } else if (unknownArgs.length > 0 && !options.partial) {
        output._unknown = unknownArgs.map((item) => item.value);
    }

    // Process collected values
    for (const [key, value] of Object.entries(values)) {
        const finalKey = options.camelCase ? camelCaseMap?.get(key) || key : key;
        const definition = definitionMap.get(key);

        output[finalKey] = definition && definition.type ? convertValue(value, definition.type) : value === undefined ? null : value;
    }

    // Handle default values
    for (const definition of definitions) {
        const key = options.camelCase ? camelCaseMap?.get(definition.name) || definition.name : definition.name;

        if (!(key in output) && definition.defaultValue !== undefined) {
            const isMultipleDefinition = definition.multiple || definition.lazyMultiple;

            output[key] = isMultipleDefinition
                ? Array.isArray(definition.defaultValue)
                    ? [...definition.defaultValue]
                    : [definition.defaultValue]
                : definition.defaultValue;
        }
    }

    // Handle grouping
    if (hasGroups) {
        const groups: Record<string, Record<string, any>> = {};
        const allOptions: Record<string, any> = {};
        const ungroupedOptions: Record<string, any> = {};

        for (const definition of definitions) {
            if (definition.group) {
                const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                for (const group of groupArray) {
                    if (!groups[group]) {
                        groups[group] = {};
                    }
                }
            }
        }

        for (const key of Object.keys(output)) {
            if (!isSpecialKey(key)) {
                allOptions[key] = output[key];

                let originalKey = key;

                if (options.camelCase) {
                    originalKey = camelCaseReverseMap?.get(key) || key;
                }

                const definition = definitionMap.get(originalKey);

                if (definition && definition.group) {
                    const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                    for (const group of groupArray) {
                        if (groups[group]) {
                            groups[group][key] = output[key];
                        }
                    }
                } else {
                    ungroupedOptions[key] = output[key];
                }
            }
        }

        const groupedOutput: CommandLineOptions = { _all: allOptions };

        for (const [group, options_] of Object.entries(groups)) {
            groupedOutput[group] = options_;
        }

        if (Object.keys(ungroupedOptions).length > 0) {
            groupedOutput._none = ungroupedOptions;
        }

        if (output._unknown) {
            groupedOutput._unknown = output._unknown;
        }

        Object.keys(output).forEach((key) => delete output[key]);
        Object.assign(output, groupedOutput);
    }

    debugLog(debugEnabled, "Final parsed result:", "resolver", output);

    return output;
};
