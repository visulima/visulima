import resolveArgs from "./resolve-args";
import { parseArgsTokens } from "./tokenizer";
import type { CommandLineOptions, InferCommandLineOptions, OptionDefinition, ParseOptions } from "./types";
import debugLog from "./utils/debug";
import validateDefinitions from "./validate-definitions";

export { AlreadySetError, InvalidDefinitionsError, InvalidValueError, UnknownOptionError, UnknownValueError } from "./errors";
export type { CommandLineOptions, InferCommandLineOptions, InferOptionValue, OptionDefinition, ParseOptions } from "./types";

/**
 * Identity helper that preserves the literal types of an option-definition array
 * so {@link commandLineArgs}/{@link parseArgs} can infer a precise result type
 * without an explicit `as const`.
 * @example
 * ```ts
 * const definitions = defineOptions([
 *   { name: "file", type: String },
 *   { name: "verbose", type: Boolean },
 * ]);
 * const args = parseArgs(definitions); // { file: string | null; verbose: boolean }
 * ```
 */
export const defineOptions = <const T extends ReadonlyArray<OptionDefinition>>(definitions: T): T => definitions;

/**
 * Returns an object containing option values parsed from the command line. By default it parses the global `process.argv` array.
 * Parsing is strict by default. To be more permissive, enable `partial` or `stopAtFirstUnknown` modes.
 *
 * When called with an `as const` array (or one created via {@link defineOptions}), the result type is
 * inferred from the definitions; otherwise it falls back to the loose {@link CommandLineOptions} shape.
 * Throws `InvalidDefinitionsError` for invalid definitions, `UnknownOptionError`/`UnknownValueError`
 * in strict mode, `AlreadySetError` for duplicate non-multiple options, and `InvalidValueError`
 * when `strictTypes` is enabled and a value fails type conversion.
 * @param optionDefinitions Single definition or array of option definitions
 * @param options Parsing options (argv, camelCase, caseInsensitive, debug, negation, partial, stopAtFirstUnknown, strictTypes)
 * @returns Parsed command-line arguments as key-value pairs
 */
export function commandLineArgs<const T extends ReadonlyArray<OptionDefinition>>(
    optionDefinitions: T,
    options?: ParseOptions,
): InferCommandLineOptions<T>;
export function commandLineArgs(optionDefinitions: OptionDefinition | ReadonlyArray<OptionDefinition>, options?: ParseOptions): CommandLineOptions;
export function commandLineArgs(optionDefinitions: OptionDefinition | ReadonlyArray<OptionDefinition>, options: ParseOptions = {}): CommandLineOptions {
    const debugEnabled = options.debug ?? false;

    debugLog(debugEnabled, "Starting command-line-args parsing", "index");
    debugLog(debugEnabled, "Options:", "index", options);

    // Handle stopAtFirstUnknown implying partial - avoid mutating input
    const effectiveOptions = { ...options };

    if (effectiveOptions.stopAtFirstUnknown) {
        effectiveOptions.partial = true;
    }

    // Normalize optionDefinitions to always be an array
    const definitions = Array.isArray(optionDefinitions) ? optionDefinitions : [optionDefinitions];

    debugLog(debugEnabled, "Normalized definitions:", "index", definitions);

    // Validate definitions
    validateDefinitions(definitions as OptionDefinition[], effectiveOptions.caseInsensitive, debugEnabled ? effectiveOptions : undefined);

    // Get argv to parse
    let { argv } = effectiveOptions;

    if (!argv) {
        // Automatically detect and skip Node.js exec args
        argv = process.argv.slice(2);

        if (process.execArgv.length > 0) {
            // Skip exec args that appear in argv
            const execArgs = new Set(process.execArgv);

            argv = argv.filter((argument) => !execArgs.has(argument));
        }
    }

    debugLog(debugEnabled, "Using argv:", "index", argv);

    // Handle case insensitive option matching
    let normalizedArgv = argv;

    if (effectiveOptions.caseInsensitive) {
        normalizedArgv = argv.map((argument) => {
            if (argument.startsWith("--")) {
                const equalsIndex = argument.indexOf("=");
                const optionName = equalsIndex === -1 ? argument.slice(2) : argument.slice(2, equalsIndex);
                const normalizedName = optionName.toLowerCase();

                return equalsIndex === -1 ? `--${normalizedName}` : `--${normalizedName}${argument.slice(equalsIndex)}`;
            }

            if (argument.startsWith("-") && !argument.startsWith("--") && argument.length > 1) {
                const flagsAndRest = argument.slice(1).split("=", 2);
                const flags = flagsAndRest[0];
                const rest = flagsAndRest[1];

                if (!flags) {
                    return argument;
                }

                const lowered = flags.toLowerCase();

                return rest === undefined ? `-${lowered}` : `-${lowered}=${rest}`;
            }

            return argument;
        });
    }

    // Tokenize arguments
    const tokens = parseArgsTokens(normalizedArgv.map(String));

    debugLog(debugEnabled, "Tokenized arguments:", "index", tokens);

    // Resolve tokens into final parsed arguments
    const result = resolveArgs(tokens, definitions as OptionDefinition[], effectiveOptions, argv);

    debugLog(debugEnabled, "Command-line-args parsing completed", "index");

    return result;
}

/**
 * Alias for {@link commandLineArgs} with a more concise name.
 *
 * `options` is optional, matching the documented `parseArgs(definitions)` usage.
 * @see commandLineArgs
 */
export const parseArgs = commandLineArgs;

/**
 * Default export of {@link commandLineArgs} for drop-in compatibility with the
 * original `command-line-args` package (`import commandLineArgs from "@visulima/command-line-args"`).
 */
export default commandLineArgs;
