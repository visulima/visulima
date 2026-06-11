/**
 * Detects the configured script shell for npm/pnpm/yarn.
 *
 * Resolution order:
 * 1. `npm_config_script_shell` env var (set by npm when running scripts)
 * 2. `npm config get script-shell` subprocess (cached after first call)
 * 3. Platform default (undefined = let the runner use /bin/sh or cmd.exe)
 */

import { execFileSync } from "node:child_process";

let cachedShellPath: string | null | undefined;

/**
 * Detect the npm script-shell configuration.
 *
 * Returns the shell path if configured, or undefined to use platform defaults.
 * The result is cached after the first call.
 */
export const detectScriptShell = (): string | undefined => {
    // Return cached result
    if (cachedShellPath !== undefined) {
        return cachedShellPath ?? undefined;
    }

    // 1. Check env var (free, set by npm when inside `npm run`)
    const envShell = process.env["npm_config_script_shell"];

    if (envShell) {
        cachedShellPath = envShell;

        return envShell;
    }

    // 2. Query npm config (one-time ~200ms cost, result cached).
    //
    // On Windows, `npm` is a `.cmd` shim. Since Node's CVE-2024-27980
    // hardening, spawning a `.cmd` via `execFileSync` without `shell: true`
    // throws EINVAL/ENOENT, which the catch below would swallow — silently
    // degrading the advertised "Honors `npm config set script-shell`
    // (Git Bash, etc.)" feature on exactly the platform (Windows) where the
    // Git Bash use case matters. Use `npm.cmd` + `shell: true` there.
    const isWindows = process.platform === "win32";

    try {
        const result = execFileSync(isWindows ? "npm.cmd" : "npm", ["config", "get", "script-shell"], {
            encoding: "utf8",
            shell: isWindows,
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 5000,
        }).trim();

        // npm prints the literal strings "undefined" or "null" when the
        // option isn't configured (the exact word depends on the npm version
        // and the cwd's package.json shape — workspaces roots emit "null",
        // standalone packages emit "undefined"). Treat both as unset.
        if (result && result !== "undefined" && result !== "null" && result !== "") {
            cachedShellPath = result;

            return result;
        }
    } catch {
        // npm not available or config query failed -- use platform defaults
    }

    // 3. Not configured -- use platform defaults
    cachedShellPath = null;

    return undefined;
};

/**
 * Reset the cached shell path. Useful for testing.
 */
export const resetShellCache = (): void => {
    cachedShellPath = undefined;
};
