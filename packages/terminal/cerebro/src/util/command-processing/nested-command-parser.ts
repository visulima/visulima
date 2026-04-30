/**
 * Parses nested command paths from argv. Matching is greedy/longest-prefix
 * so a parent path can coexist with its nested children (parent wins iff the
 * child segment is absent).
 * @param availableCommands Map of all available commands keyed by their full path string
 * @param argv Command line arguments to parse
 * @returns Object with the matched command path and remaining argv
 */
export const parseNestedCommand = (availableCommands: Map<string, string[]>, argv: string[]): { argv: string[]; commandPath: string[] | undefined } => {
    if (argv.length === 0) {
        return { argv: [], commandPath: undefined };
    }

    const pathKeyParts: string[] = [];
    let bestMatch: { commandPath: string[]; depth: number } | undefined;

    for (let depth = 1; depth <= argv.length; depth += 1) {
        const argument = argv[depth - 1];

        if (argument === undefined || argument.startsWith("-")) {
            break;
        }

        pathKeyParts.push(argument);
        const pathKey = pathKeyParts.join(" ");

        if (availableCommands.has(pathKey)) {
            bestMatch = { commandPath: [...pathKeyParts], depth };
        }
    }

    if (bestMatch) {
        return { argv: argv.slice(bestMatch.depth), commandPath: bestMatch.commandPath };
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
