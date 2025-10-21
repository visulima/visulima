import resolveArgs from "./resolve-args";
import { parseArgsTokens } from "./tokenizer";
import type { CommandLineOptions, OptionDefinition, ParseOptions } from "./types";
import debugLog from "./utils/debug";
import validateDefinitions from "./validate-definitions";

export { AlreadySetError, InvalidDefinitionsError, UnknownOptionError, UnknownValueError } from "./errors";
export type { CommandLineOptions, OptionDefinition, ParseOptions } from "./types";

/**
 * Returns an object containing option values parsed from the command line. By default it parses the global `process.argv` array.
 * Parsing is strict by default. To be more permissive, enable `partial` or `stopAtFirstUnknown` modes.
 * @param optionDefinitions Single definition or array of option definitions
 * @param options Parsing options (argv, camelCase, caseInsensitive, debug, partial, stopAtFirstUnknown)
 * @returns Parsed command-line arguments as key-value pairs
 */
export const commandLineArgs = (optionDefinitions: OptionDefinition | ReadonlyArray<OptionDefinition>, options: ParseOptions = {}): CommandLineOptions => {
    const debugEnabled = options.debug || false;

    debugLog(debugEnabled, "Starting command-line-args parsing", "index");
    debugLog(debugEnabled, "Options:", "index", options);

    // Handle stopAtFirstUnknown implying partial
    if (options.stopAtFirstUnknown) {
        // eslint-disable-next-line no-param-reassign
        options.partial = true;
    }

    // Normalize optionDefinitions to always be an array
    const definitions = Array.isArray(optionDefinitions) ? optionDefinitions : [optionDefinitions];

    debugLog(debugEnabled, "Normalized definitions:", "index", definitions);

    // Validate definitions
    validateDefinitions(definitions as OptionDefinition[], options.caseInsensitive, debugEnabled ? options : undefined);

    // Get argv to parse
    let { argv } = options;

    if (!argv) {
        // Automatically detect and skip Node.js exec args
        argv = process.argv.slice(2);

        if (process.execArgv?.length) {
            // Skip exec args that appear in argv
            const execArgs = new Set(process.execArgv);

            argv = argv.filter((argument) => !execArgs.has(argument));
        }
    }

    debugLog(debugEnabled, "Using argv:", "index", argv);

    // Handle case insensitive option matching
    let normalizedArgv = argv;

    if (options.caseInsensitive) {
        normalizedArgv = argv.map((argument) => {
            if (argument.startsWith("--")) {
                const equalsIndex = argument.indexOf("=");
                const optionName = equalsIndex === -1 ? argument.slice(2) : argument.slice(2, equalsIndex);
                const normalizedName = optionName.toLowerCase();

                return equalsIndex === -1 ? `--${normalizedName}` : `--${normalizedName}${argument.slice(equalsIndex)}`;
            }

            if (argument.startsWith("-") && !argument.startsWith("--") && argument.length > 1) {
                const [flags, rest] = argument.slice(1).split("=", 2);
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
    const result = resolveArgs(tokens, definitions as OptionDefinition[], options, argv);

    debugLog(debugEnabled, "Command-line-args parsing completed", "index");

    return result;
};

/**
 * Alias for commandLineArgs with a more concise name.
 * @see commandLineArgs
 */
export const parseArgs = commandLineArgs;
