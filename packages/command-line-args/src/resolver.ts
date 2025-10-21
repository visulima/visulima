import { AlreadySetError, UnknownOptionError, UnknownValueError } from "./errors/index";
import type { CommandLineOptions, OptionDefinition, ParseOptions } from "./index.js";
import type { ArgToken as ArgumentToken } from "./tokenizer/index.js";
import { convertValue } from "./type-conversion";

/**
 * Debug logging utility.
 */
const debugLog = (enabled: boolean, message: string, ...args: any[]) => {
    if (enabled) {
        console.log(`[command-line-args:resolver] ${message}`, ...args);
    }
};

// Helper function for type checking
const isBooleanType = (type: any): boolean => {
    const result = type && (type === Boolean || (typeof type === "function" && type.name?.startsWith("Boolean")));

    return result;
};

/**
 * Resolved arguments from tokens according to option definitions.
 */
export const resolveArgs = (tokens: ArgumentToken[], definitions: OptionDefinition[], options: ParseOptions, argv: string[]): CommandLineOptions => {
    debugLog(options.debug || false, `resolveArgs called with options:`, { partial: options.partial, stopAtFirstUnknown: options.stopAtFirstUnknown });
    debugLog(options.debug || false, "Starting argument resolution");
    debugLog(options.debug || false, "Tokens:", tokens);
    debugLog(options.debug || false, "Definitions:", definitions);
    debugLog(options.debug || false, "Processing tokens...");

    // Build fast lookup maps for option definitions and pre-compute camelCase names
    const definitionMap = new Map<string, OptionDefinition>();
    const aliasMap = new Map<string, OptionDefinition>();
    const caseInsensitiveNameMap = new Map<string, OptionDefinition>();
    const caseInsensitiveAliasMap = new Map<string, OptionDefinition>();
    const camelCaseMap = new Map<string, string>(); // Cache camelCase transformations

    for (const definition of definitions) {
        definitionMap.set(definition.name, definition);

        if (definition.alias) {
            aliasMap.set(definition.alias, definition);
        }

        // Build case insensitive maps if needed
        if (options.caseInsensitive) {
            caseInsensitiveNameMap.set(definition.name.toLowerCase(), definition);

            if (definition.alias) {
                caseInsensitiveAliasMap.set(definition.alias.toLowerCase(), definition);
            }
        }

        // Pre-compute camelCase version if needed (optimized regex)
        if (options.camelCase) {
            camelCaseMap.set(
                definition.name,
                definition.name.replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
            );
        }
    }

    // Convert args-tokens result to command-line-args format
    const output: CommandLineOptions = {};

    // Process tokens to extract values - optimized single pass
    const values: Record<string, any> = {};
    const unknownArgs: Array<{ index: number; value: string }> = [];
    const consumedPositionalIndices = new Set<number>();
    let stoppedByTerminator = false;

    const defaultOptionDefinition = definitions.find((d) => d.defaultOption);

    // Single optimized pass through tokens
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.kind === "option-terminator") {
            // Stop processing further tokens and collect everything from here onward
            output._unknown = argv.slice(token.index);
            stoppedByTerminator = true;
            break;
        }

        if (token.kind === "option" && token.name) {
            // Fast lookup for option definition
            let definition = definitionMap.get(token.name) || aliasMap.get(token.name);

            if (!definition && options.caseInsensitive) {
                definition = caseInsensitiveNameMap.get(token.name) || caseInsensitiveAliasMap.get(token.name);
            }

            // Handle numeric option names (e.g., --1 should set a Number type option)
            if (!definition && token.value === undefined && /^\d+$/.test(token.name)) {
                const numberDefinition = definitions.find(
                    (def) => def.type && (def.type === Number || (typeof def.type === "function" && def.type.name === "Number")),
                );

                if (numberDefinition) {
                    definition = numberDefinition;
                    // Modify the token to have the numeric value and correct name
                    (token as any).value = token.name;
                    (token as any).name = numberDefinition.name;
                }
            }

            const optionName = definition ? definition.name : token.name;
            const isMultiple = definition && definition.multiple;
            const isLazyMultiple = definition && definition.lazyMultiple;

            // Check if option is already set (not allowed for non-multiple options, except in partial mode)
            if (values[optionName] !== undefined && !isMultiple && !isLazyMultiple && !options.partial) {
                throw new AlreadySetError(optionName);
            }

            // In partial mode, collect unknown options and skip processing them
            if (!definition && options.partial) {
                // For unknown options, use the raw argument from the token
                const rawArg = token.rawName || `--${token.name}${token.value !== undefined && token.inlineValue ? `=${token.value}` : ""}`;
                unknownArgs.push({ index: token.index, value: rawArg });
                continue;
            }

            // For stopAtFirstUnknown, treat unknown options as unknown and stop processing further tokens
            if (!definition && options.stopAtFirstUnknown) {
                // Collect this and all remaining args as unknown
                output._unknown = argv.slice(token.index);
                break;
            }

            // Throw error for unknown options when not in partial mode
            if (!definition && !options.partial) {
                throw new UnknownOptionError(token.name);
            }

            if (token.value === undefined) {
                // Option without inline value
                const nextToken = tokens[i + 1];

                // For defaultOption, don't consume positional arguments as values unless it's non-multiple
                // Also don't consume positionals for unknown options (they might be unknown arguments)
                const shouldConsumeValue = nextToken && nextToken.kind === "positional" && definition && !(definition.type && isBooleanType(definition.type));
                const isDefaultOptionNonMultiple = definition && definition.defaultOption && !definition.multiple && !definition.lazyMultiple;
                if (shouldConsumeValue && (!definition?.defaultOption || isDefaultOptionNonMultiple)) {
                    if (isMultiple) {
                        // For multiple options, collect consecutive positionals
                        let currentIndex = i + 1;
                        const collectedValues: any[] = [];

                        while (currentIndex < tokens.length && tokens[currentIndex].kind === "positional") {
                            collectedValues.push(tokens[currentIndex].value);
                            consumedPositionalIndices.add(tokens[currentIndex].index);
                            currentIndex++;
                        }

                        if (values[optionName] === undefined) {
                            values[optionName] = collectedValues;
                        } else {
                            // If already exists, append
                            if (!Array.isArray(values[optionName])) {
                                values[optionName] = [values[optionName]];
                            }

                            values[optionName].push(...collectedValues);
                        }

                        // Skip consumed tokens
                        i = currentIndex - 1;
                    } else if (isLazyMultiple) {
                        // For lazyMultiple options, only consume one positional
                        if (values[optionName] === undefined) {
                            values[optionName] = [nextToken.value];
                        } else {
                            // If already exists, append
                            if (!Array.isArray(values[optionName])) {
                                values[optionName] = [values[optionName]];
                            }

                            values[optionName].push(nextToken.value);
                        }

                        consumedPositionalIndices.add(nextToken.index);
                        i++; // Skip the consumed positional
                    } else {
                        // Single value - take first positional
                        values[optionName] = nextToken.value;
                        consumedPositionalIndices.add(nextToken.index);
                        i++; // Skip the consumed positional
                    }
                } else {
                    // Option without value - check if it should be boolean or null
                    if (definition && definition.type && isBooleanType(definition.type)) {
                        // For boolean options, handle multiple values
                        if (isMultiple) {
                            if (values[optionName] === undefined) {
                                values[optionName] = [true];
                            } else if (Array.isArray(values[optionName])) {
                                values[optionName].push(true);
                            } else {
                                values[optionName] = [values[optionName], true];
                            }
                        } else {
                            values[optionName] = true;
                        }
                    } else {
                        // For multiple options without values, initialize as empty array
                        values[optionName] = isMultiple ? [] : null;
                    }
                }
            } else {
                // Option with inline value (--option=value)
                let { value } = token;

                // Special handling for boolean options with inline values
                if (definition && definition.type && isBooleanType(definition.type)) {
                    switch (value) {
                        case "": {
                            // Empty value for boolean option in inline notation
                            if (options.partial) {
                                // In partial mode, set the value AND add to unknown
                                if (!values._unknown) {
                                    values._unknown = [];
                                }

                                values._unknown.push(`${token.rawName || `--${token.name}`}${token.value ? `=${token.value}` : ""}`);
                                value = true; // Still set the boolean value
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
                            // Invalid boolean value
                            value = true; // Default to true for boolean options
                        }
                    }
                }

                // For multiple options, collect consecutive positional values
                const collectedValues: any[] = value !== undefined ? [value] : [];

                if (isMultiple) {
                    // Collect consecutive positional tokens after this option
                    let currentIndex = i + 1;

                    while (currentIndex < tokens.length && tokens[currentIndex].kind === "positional") {
                        collectedValues.push(tokens[currentIndex].value);
                        consumedPositionalIndices.add(tokens[currentIndex].index);
                        currentIndex++;
                    }
                    i = currentIndex - 1; // Skip consumed tokens
                }

                if (values[optionName] === undefined) {
                    values[optionName] = isMultiple || isLazyMultiple ? collectedValues : value;
                } else if (isMultiple || isLazyMultiple) {
                    // Handle multiple values
                    if (!Array.isArray(values[optionName])) {
                        values[optionName] = [values[optionName]];
                    }

                    values[optionName].push(...collectedValues);
                } else {
                    // For singular options, allow inline values to override existing values
                    values[optionName] = value;
                }
            }
        } else if (token.kind === "positional" && options.stopAtFirstUnknown && !consumedPositionalIndices.has(token.index)) {
            // Found unconsumed positional token - collect everything from here onward as unknown
            debugLog(options.debug || false, `Found unconsumed positional token at index ${token.index}, stopping processing`);
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

    // Handle defaultOption - collect remaining positional arguments
    if (defaultOptionDefinition) {
        const positionalValues: any[] = [];
        const positionalTokens: ArgumentToken[] = [];

        tokens.forEach((token) => {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                positionalValues.push(token.value);
                positionalTokens.push(token);
            }
        });

        if (positionalValues.length > 0) {
            const existingValue = values[defaultOptionDefinition.name];
            const isMultiple = defaultOptionDefinition.multiple || defaultOptionDefinition.lazyMultiple;

            if (existingValue === undefined) {
                // For multiple defaultOption, take all values and mark as consumed
                if (isMultiple) {
                    positionalValues.forEach((_, idx) => {
                        consumedPositionalIndices.add(positionalTokens[idx].index);
                    });
                    values[defaultOptionDefinition.name] = positionalValues;
                } else {
                    // For singular defaultOption, only take and mark first value as consumed
                    consumedPositionalIndices.add(positionalTokens[0].index);
                    values[defaultOptionDefinition.name] = positionalValues[0];
                }
            } else if (isMultiple) {
                // Multiple already has a value, append remaining positionals first, then existing values
                positionalValues.forEach((_, idx) => {
                    consumedPositionalIndices.add(positionalTokens[idx].index);
                });
                if (!Array.isArray(existingValue)) {
                    values[defaultOptionDefinition.name] = [...positionalValues, existingValue];
                } else {
                    values[defaultOptionDefinition.name] = [...positionalValues, ...existingValue];
                }
            }
            // For singular, keep existing value if already set (don't consume remaining positionals)
        }
    }

    // In non-partial mode, throw error for unconsumed positional arguments
    if (!options.partial) {
        tokens.forEach((token) => {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                throw new UnknownValueError(argv[token.index]);
            }
        });
    }

    // In partial mode, collect any remaining unconsumed positional arguments as unknown
    if (options.partial && !options.stopAtFirstUnknown) {
        const allUnknownItems: { index: number; value: string }[] = [];

        // Collect already found unknown options from unknownArgs
        unknownArgs.forEach((item) => {
            allUnknownItems.push(item);
        });

        // Also collect unknown options that were added during processing
        if (values._unknown) {
            values._unknown.forEach((argument: string) => {
                const index = argv.indexOf(argument);
                if (index !== -1) {
                    allUnknownItems.push({ index, value: argument });
                }
            });
        }

        // Collect unconsumed positional tokens
        tokens.forEach((token) => {
            if (token.kind === "positional" && !consumedPositionalIndices.has(token.index)) {
                allUnknownItems.push({ index: token.index, value: argv[token.index] });
            }
        });

        // Sort by index and output
        if (allUnknownItems.length > 0) {
            allUnknownItems.sort((a, b) => a.index - b.index);
            output._unknown = allUnknownItems.map(item => item.value);
        }
    }

    // Handle stopAtFirstUnknown - collect remaining unknown args
    if (options.stopAtFirstUnknown && !stoppedByTerminator) {
        // Find the first unknown option
        const firstUnknownOptionIndex = tokens.findIndex(
            (token) =>
                token.kind === "option" &&
                !definitionMap.has(token.name || "") &&
                !aliasMap.has(token.name || "") &&
                (!options.caseInsensitive ||
                    (!caseInsensitiveNameMap.has(token.name?.toLowerCase() || "") && !caseInsensitiveAliasMap.has(token.name?.toLowerCase() || ""))),
        );

        // Find the first unconsumed positional argument
        const firstUnconsumedPositionalIndex = tokens.findIndex((token) => token.kind === "positional" && !consumedPositionalIndices.has(token.index));

        // Use the earliest unknown
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
        // Only set unknownArgs as unknown if we're not in partial mode
        // (in partial mode, _unknown was already set in the partial block above)
        output._unknown = unknownArgs.map(item => item.value);
    }

    // Process collected values
    Object.entries(values).forEach(([key, value]) => {
        // Apply camelCase conversion if requested (use cached version)
        const finalKey = options.camelCase ? camelCaseMap.get(key) || key : key;

        // Handle type conversion for all types
        const definition = definitionMap.get(key);

        if (definition && definition.type) {
            output[finalKey] = convertValue(value, definition.type);
        } else {
            // Use value as-is, but convert undefined to null for consistency
            output[finalKey] = value === undefined ? null : value;
        }
    });

    // Handle default values that weren't provided
    definitions.forEach((definition) => {
        const key = options.camelCase ? camelCaseMap.get(definition.name) || definition.name : definition.name;

        if (!(key in output) && definition.defaultValue !== undefined) {
            const isMultipleDefinition = definition.multiple || definition.lazyMultiple;

            if (isMultipleDefinition) {
                // For multiple options, defaultValue should be an array or we wrap it
                output[key] = Array.isArray(definition.defaultValue) ? [...definition.defaultValue] : [definition.defaultValue];
            } else {
                output[key] = definition.defaultValue;
            }
        }
    });

    // Handle grouping
    const groups: Record<string, Record<string, any>> = {};

    definitions.forEach((definition) => {
        if (definition.group) {
            const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

            groupArray.forEach((group) => {
                if (!groups[group]) {
                    groups[group] = {};
                }
            });
        }
    });

    // Add options to their groups and collect all options
    const allOptions: Record<string, any> = {};
    const ungroupedOptions: Record<string, any> = {};

    Object.keys(output).forEach((key) => {
        if (key.charAt(0) !== "_") {
            allOptions[key] = output[key];

            // Find the definition for this key to see if it's grouped
            // When camelCase is enabled, we need to find the original name from the camelCased key
            let originalKey = key;
            if (options.camelCase) {
                // Find the original key that maps to this camelCased key
                for (const [orig, camel] of camelCaseMap) {
                    if (camel === key) {
                        originalKey = orig;
                        break;
                    }
                }
            }
            const definition = definitionMap.get(originalKey);

            if (definition && definition.group) {
                const groupArray = Array.isArray(definition.group) ? definition.group : [definition.group];

                groupArray.forEach((group) => {
                    if (groups[group]) {
                        groups[group][key] = output[key];
                    }
                });
            } else {
                // Ungrouped option
                ungroupedOptions[key] = output[key];
            }
        }
    });

    // Add grouping to output
    if (Object.keys(groups).length > 0) {
        // When grouping is present, replace the output with only grouped results
        const groupedOutput: CommandLineOptions = {};

        groupedOutput._all = allOptions;

        // Add group objects
        Object.keys(groups).forEach((group) => {
            groupedOutput[group] = groups[group];
        });

        // Handle _none group (ungrouped options) - only if there are ungrouped options
        if (Object.keys(ungroupedOptions).length > 0) {
            groupedOutput._none = ungroupedOptions;
        }

        // Preserve _unknown if it exists
        if (output._unknown) {
            groupedOutput._unknown = output._unknown;
        }

        // Replace the output with the grouped version
        Object.keys(output).forEach((key) => delete output[key]);
        Object.assign(output, groupedOutput);
    }

    debugLog(options.debug || false, "Final parsed result:", output);

    return output;
};

