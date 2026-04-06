import type { ConcurrentCommandConfig, ConcurrentCommandInput } from "../types";
import { expandArguments } from "./expand-arguments";
import { expandShortcut } from "./expand-shortcut";
import { expandWildcard } from "./expand-wildcard";
import { stripQuotes } from "./strip-quotes";

export interface ParseCommandsOptions {
    /** Additional arguments for placeholder expansion ({1}, {@}, {*}). */
    additionalArguments?: string[];
}

/**
 * Parse and expand command inputs through the full pipeline:
 * 1. Normalize string inputs to config objects
 * 2. Strip surrounding quotes
 * 3. Expand package manager shortcuts (npm:build -> npm run build)
 * 4. Expand wildcard patterns (npm run watch-* -> multiple commands)
 * 5. Expand argument placeholders ({1}, {@}, {*})
 */
export const parseCommands = (inputs: ConcurrentCommandInput[], options: ParseCommandsOptions = {}): ConcurrentCommandConfig[] => {
    const { additionalArguments = [] } = options;

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

    // Step 5: expand arguments
    if (additionalArguments.length > 0) {
        configs = configs.map((config) => expandArguments(config, additionalArguments));
    }

    return configs;
};

export { expandArguments } from "./expand-arguments";
export { expandShortcut } from "./expand-shortcut";
export { expandWildcard } from "./expand-wildcard";
export { stripQuotes } from "./strip-quotes";
