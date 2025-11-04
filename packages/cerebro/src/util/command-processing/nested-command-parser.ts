/**
 * Parses nested command paths from argv.
 * Supports both flat commands (e.g., "build") and nested commands (e.g., "deploy staging").
 * Optimized to reduce string operations
 * @param availableCommands Map of all available commands keyed by their full path string
 * @param argv Command line arguments to parse
 * @returns Object with the matched command path and remaining argv
 */
export const parseNestedCommand = (availableCommands: Map<string, string[]>, argv: string[]): { argv: string[]; commandPath: string[] | null } => {
    if (argv.length === 0) {
        return { argv: [], commandPath: null };
    }

    // Try to match progressively longer command paths
    // Start with single token, then two tokens, etc.
    // Optimize: build path key incrementally instead of joining entire array each time
    const pathKeyParts: string[] = [];

    for (let depth = 1; depth <= argv.length; depth++) {
        pathKeyParts.push(argv[depth - 1]);
        const pathKey = pathKeyParts.join(" ");

        // Check if this path matches a registered command
        if (availableCommands.has(pathKey)) {
            const remainingArgv = argv.slice(depth);

            return { argv: remainingArgv, commandPath: [...pathKeyParts] };
        }
    }

    // No match found
    return { argv, commandPath: null };
};

/**
 * Generates a lookup key from a command path array.
 * @param commandPath Array of command path segments
 * @returns String key for the command path
 */
export const getCommandPathKey = (commandPath: string[]): string => commandPath.join(" ");

/**
 * Generates the full command path for a command, including its commandPath if present.
 * @param commandName The command name
 * @param commandPath Optional command path from the command definition
 * @returns Full command path array
 */
export const getFullCommandPath = (commandName: string, commandPath?: string[]): string[] => {
    if (commandPath && commandPath.length > 0) {
        return [...commandPath, commandName];
    }

    return [commandName];
};
