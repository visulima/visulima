/**
 * Parses nested command paths from argv.
 * Supports both flat commands (e.g., "build") and nested commands (e.g., "deploy staging").
 * @param availableCommands Map of all available commands keyed by their full path string
 * @param argv Command line arguments to parse
 * @returns Object with the matched command path and remaining argv
 */
export const parseNestedCommand = (availableCommands: Map<string, string[]>, argv: string[]): { argv: string[]; commandPath: string[] | undefined } => {
    if (argv.length === 0) {
        return { argv: [], commandPath: undefined };
    }

    const pathKeyParts: string[] = [];

    for (let depth = 1; depth <= argv.length; depth += 1) {
        pathKeyParts.push(argv[depth - 1]);
        const pathKey = pathKeyParts.join(" ");

        if (availableCommands.has(pathKey)) {
            const remainingArgv = argv.slice(depth);

            return { argv: remainingArgv, commandPath: [...pathKeyParts] };
        }
    }

    return { argv, commandPath: undefined };
};

/**
 * Generates a lookup key from a command path array.
 * @param commandPath Array of command path segments
 * @returns The command path key string
 */
export const getCommandPathKey = (commandPath: string[]): string => commandPath.join(" ");

/**
 * Generates the full command path for a command, including its commandPath if present.
 * Combines the command name with any parent path segments.
 * @param commandName The name of the command to add to the path
 * @param commandPath Optional path segments from the command definition
 * @returns The full command path array combining commandPath and commandName
 */
export const getFullCommandPath = (commandName: string, commandPath?: string[]): string[] => {
    if (commandPath && commandPath.length > 0) {
        return [...commandPath, commandName];
    }

    return [commandName];
};
