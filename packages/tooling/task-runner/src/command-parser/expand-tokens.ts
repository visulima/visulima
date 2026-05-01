import { shellQuote } from "./shell-quote";
import type { ConcurrentCommandConfig } from "../types";

/**
 * Context for token interpolation.
 *
 * Currently the only first-class token group is `affected` (and its alias
 * `changed_files`). Pass `affected.files` (workspace-relative paths) and
 * the renderer will substitute it into command strings such as
 * `eslint ${affected.files}` or `prettier ${changed_files | flag '--file'}`.
 *
 * Optional `projectRoot` makes paths relative to a single project root,
 * stripping the leading prefix and the immediately following `/`. Files
 * outside the root are dropped — token interpolation only emits paths
 * the task can actually act on.
 */
export interface TokenContext {
    /** Affected/changed files, relative to workspace root. */
    affectedFiles?: string[];

    /**
     * When set, paths are rewritten relative to this project root and
     * files outside the root are filtered out.
     */
    projectRoot?: string;
}

/**
 * Recognised token names. Aliases collapse onto one source list:
 *   `affected.files` and `changed_files` both expand to `affectedFiles`.
 */
const TOKEN_PATHS: Record<string, "affectedFiles"> = {
    "affected.files": "affectedFiles",
    changed_files: "affectedFiles",
};

/**
 * Matches `${ name }` or `${ name | flag 'value' }` (and `"value"`).
 * Whitespace inside the braces is tolerated. The flag value may be empty
 * (e.g. `${affected.files | flag ''}`) — the renderer treats that as
 * a no-op flag and just emits the bare paths. Mismatched quotes
 * (`'value"`) are accepted by the regex but rejected by the renderer.
 */
const TOKEN_REGEX = /\\?\$\{\s*([\w.]+)\s*(?:\|\s*flag\s+(["'])(.*?)\2\s*)?\}/g;

/**
 * Rewrites a workspace-relative file path to be relative to a project
 * root. Returns `undefined` when the file is outside the root so the
 * caller can filter it out.
 *
 * Assumes POSIX separators (`/`). Affected-files lists come from
 * `git diff --name-only`, which always emits forward slashes — even
 * on Windows — so backslash paths are not handled here.
 */
const rewriteForProjectRoot = (filePath: string, projectRoot: string): string | undefined => {
    if (filePath === projectRoot) {
        return ".";
    }

    const prefix = `${projectRoot}/`;

    if (filePath.startsWith(prefix)) {
        return filePath.slice(prefix.length);
    }

    return undefined;
};

/**
 * Expands token references in a single command string.
 *
 * Supported tokens:
 *   `${affected.files}`                       — space-joined, shell-quoted paths
 *   `${changed_files}`                        — alias of `affected.files`
 *   `${affected.files | flag '--file'}`       — `--file path1 --file path2 ...`
 *
 * Unknown tokens are left in place — they may be environment-variable
 * references the shell will expand at runtime, and silently dropping
 * them would mask bugs in user commands.
 *
 * Escape with a leading backslash (`\${affected.files}`) to emit the
 * literal token without expansion. Note: the regex consumes at most
 * one leading backslash, so `\\${...}` collapses to `\${...}` rather
 * than producing a literal backslash followed by the literal token.
 * Use a different surrounding quoting scheme if you need a real
 * backslash adjacent to a token.
 */
export const expandTokensInString = (command: string, context: TokenContext): string =>
    command.replaceAll(TOKEN_REGEX, (match, name: string, _quote: string | undefined, flagValue: string | undefined) => {
        if (match.startsWith("\\")) {
            return match.slice(1);
        }

        const sourceKey = TOKEN_PATHS[name];

        if (!sourceKey) {
            return match;
        }

        const rawFiles = context[sourceKey] ?? [];
        const files = context.projectRoot
            ? rawFiles
                .map((f) => rewriteForProjectRoot(f, context.projectRoot as string))
                .filter((f): f is string => f !== undefined)
            : rawFiles;

        if (files.length === 0) {
            return "";
        }

        if (flagValue !== undefined && flagValue.length > 0) {
            return files.map((file) => `${flagValue} ${shellQuote(file)}`).join(" ");
        }

        return files.map(shellQuote).join(" ");
    });

/**
 * Pipeline-friendly variant of {@link expandTokensInString} that takes
 * and returns a `ConcurrentCommandConfig`. Plays the same role as
 * {@link import("./expand-arguments").expandArguments} so it can slot
 * into {@link import("./index").parseCommands} as a normal step.
 */
export const expandTokens = (config: ConcurrentCommandConfig, context: TokenContext): ConcurrentCommandConfig => {
    // Cheap fast-path: no `${` ⇒ no token possible. Avoids a regex
    // pass on every command in the typical no-token case.
    if (!config.command.includes("${")) {
        return config;
    }

    const command = expandTokensInString(config.command, context);

    if (command === config.command) {
        return config;
    }

    return { ...config, command };
};
