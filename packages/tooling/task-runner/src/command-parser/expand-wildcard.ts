import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ConcurrentCommandConfig } from "../types";

const RUN_COMMAND_REGEX = /(?:npm|yarn|pnpm|bun) run|node --run|deno task/;

/**
 * Reads scripts field from package.json at the given directory.
 * No command execution involved -- purely file I/O.
 */
const readPackageScripts = (cwd: string): Record<string, string> => {
    try {
        const raw = readFileSync(join(cwd, "package.json"), "utf8");
        const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
        return pkg.scripts ?? {};
    } catch {
        return {};
    }
};

/**
 * Escapes a string for use in a regular expression.
 */
const escapeRegExp = (s: string): string => s.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");

/**
 * Expands wildcard patterns in package manager "run" commands.
 *
 * Reads scripts from package.json and matches against the wildcard pattern.
 * Returns one ConcurrentCommandConfig per matching script.
 *
 * Example: "npm run watch-*" with scripts { "watch-js": "...", "watch-css": "..." }
 *          -> ["npm run watch-js", "npm run watch-css"]
 *
 * No user input is involved -- patterns come from the calling code.
 */
export const expandWildcard = (config: ConcurrentCommandConfig): ConcurrentCommandConfig | ConcurrentCommandConfig[] => {
    const { command } = config;

    // Check if this is a "run" command with a wildcard
    const runMatch = RUN_COMMAND_REGEX.exec(command);

    if (!runMatch) {
        return config;
    }

    const afterRun = command.slice(runMatch.index + runMatch[0].length).trim();
    const scriptPattern = afterRun.split(/\s/)[0] ?? "";

    if (!scriptPattern.includes("*")) {
        return config;
    }

    const cwd = config.cwd ?? process.cwd();
    const scripts = readPackageScripts(cwd);
    const scriptNames = Object.keys(scripts);

    // Build regex from the wildcard pattern
    const parts = scriptPattern.split("*");
    const regexStr = parts.map(escapeRegExp).join("(.+)");
    const wildcardRegex = new RegExp(`^${regexStr}$`);

    // Check for omission filter: pattern!(exclude)
    const omitMatch = /!\(([^)]+)\)/.exec(scriptPattern);
    let omitRegex: RegExp | undefined;

    if (omitMatch) {
        omitRegex = new RegExp(omitMatch[1]!);
    }

    const matching = scriptNames.filter((name) => {
        if (!wildcardRegex.test(name)) {
            return false;
        }

        if (omitRegex && omitRegex.test(name)) {
            return false;
        }

        return true;
    });

    if (matching.length === 0) {
        return config;
    }

    const remainingArgs = afterRun.slice(scriptPattern.length);
    const runPrefix = command.slice(0, runMatch.index + runMatch[0].length);

    return matching.map((scriptName) => ({
        ...config,
        command: `${runPrefix} ${scriptName}${remainingArgs}`,
        name: config.name ?? scriptName,
    }));
};
