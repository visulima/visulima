import type { ConcurrentCommandConfig } from "../types";

/**
 * Removes surrounding quotes from a command string.
 * Handles both single and double quotes.
 */
export const stripQuotes = (config: ConcurrentCommandConfig): ConcurrentCommandConfig => {
    const { command } = config;

    if (/^".+?"$/.test(command) || /^'.+?'$/.test(command)) {
        return { ...config, command: command.slice(1, -1) };
    }

    return config;
};
