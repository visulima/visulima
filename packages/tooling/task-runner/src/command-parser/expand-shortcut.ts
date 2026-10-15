import type { ConcurrentCommandConfig } from "../types";

const SHORTCUT_REGEX = /^(npm|yarn|pnpm|bun|node):(\S+)(.*)/;

/**
 * Expands package manager shortcuts into full commands.
 *
 * This parser transforms shorthand notation into proper package manager
 * invocations. No user input is involved -- command strings originate
 * from the calling code which reads package.json scripts.
 *
 * Examples:
 *   npm:build    -> npm run build
 *   pnpm:test    -> pnpm run test
 *   node:script  -> node --run script
 */
export const expandShortcut = (config: ConcurrentCommandConfig): ConcurrentCommandConfig => {
    const match = SHORTCUT_REGEX.exec(config.command);

    if (!match) {
        return config;
    }

    const [, prefix, script, args] = match;

    const runPrefix = prefix === "node" ? "node --run" : `${prefix} run`;

    return {
        ...config,
        command: `${runPrefix} ${script}${args}`,
        name: config.name ?? script,
    };
};
