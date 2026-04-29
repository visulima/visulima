import type { ConcurrentCommandConfig, ConcurrentCommandInput } from "../types";
import { expandArguments } from "./expand-arguments";
import { expandShortcut } from "./expand-shortcut";
import type { TokenContext } from "./expand-tokens";
import { expandTokens } from "./expand-tokens";
import { expandWildcard } from "./expand-wildcard";
import { stripQuotes } from "./strip-quotes";

export interface ParseCommandsOptions {
    /** Additional arguments for placeholder expansion ({1}, {@}, {*}). */
    additionalArguments?: string[];

    /**
     * Token interpolation context. When supplied, `${affected.files}`
     * and `${changed_files | flag '--file'}` references in command
     * strings are expanded before argument placeholder substitution.
     */
    tokens?: TokenContext;
}

/**
 * Parse and expand command inputs through the full pipeline:
 * 1. Normalize string inputs to config objects
 * 2. Strip surrounding quotes
 * 3. Expand package manager shortcuts (npm:build -> npm run build)
 * 4. Expand wildcard patterns (npm run watch-* -> multiple commands)
 * 5. Expand token references (${affected.files}, ${changed_files | flag '...'})
 * 6. Expand argument placeholders ({1}, {@}, {*})
 */
export const parseCommands = (inputs: ConcurrentCommandInput[], options: ParseCommandsOptions = {}): ConcurrentCommandConfig[] => {
    const { additionalArguments = [], tokens } = options;

    // Step 1: normalize
    let configs: ConcurrentCommandConfig[] = inputs.map((input) => {
        if (typeof input === "string") {
            return { command: input };
        }

        return { ...input };
    });

    // Step 2: strip quotes
    configs = configs.map(stripQuotes);

    // Step 3: expand shortcuts
    configs = configs.map(expandShortcut);

    // Step 4: expand wildcards (may produce multiple configs per input)
    configs = configs.flatMap((config) => {
        const result = expandWildcard(config);

        return Array.isArray(result) ? result : [result];
    });

    // Step 5: expand tokens
    if (tokens) {
        configs = configs.map((config) => expandTokens(config, tokens));
    }

    // Step 6: expand arguments
    if (additionalArguments.length > 0) {
        configs = configs.map((config) => expandArguments(config, additionalArguments));
    }

    return configs;
};

export { expandArguments } from "./expand-arguments";
export { expandShortcut } from "./expand-shortcut";
export type { TokenContext } from "./expand-tokens";
export { expandTokens, expandTokensInString } from "./expand-tokens";
export { expandWildcard } from "./expand-wildcard";
export { stripQuotes } from "./strip-quotes";
