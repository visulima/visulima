import { shellQuote } from "./shell-quote";
import type { ConcurrentCommandConfig } from "../types";

const PLACEHOLDER_REGEX = /\\?\{([@*]|[1-9]\d*)\}/g;

/**
 * Expands argument placeholders in command strings.
 *
 * Placeholders:
 *   {1}, {2}, ...  -> specific positional argument
 *   {@}            -> all arguments, individually quoted
 *   {*}            -> all arguments as a single quoted string
 *   \{1}           -> literal {1} (escaped)
 */
export const expandArguments = (config: ConcurrentCommandConfig, additionalArguments: string[]): ConcurrentCommandConfig => {
    if (additionalArguments.length === 0) {
        return config;
    }

    const command = config.command.replaceAll(PLACEHOLDER_REGEX, (match, target: string) => {
        // Escaped placeholder: \{1} -> {1}
        if (match.startsWith("\\")) {
            return match.slice(1);
        }

        const index = Number(target);

        if (!Number.isNaN(index) && index <= additionalArguments.length) {
            return shellQuote(additionalArguments[index - 1]!);
        }

        if (target === "@") {
            return additionalArguments.map(shellQuote).join(" ");
        }

        if (target === "*") {
            return shellQuote(additionalArguments.join(" "));
        }

        return "";
    });

    return { ...config, command };
};
