import { existsSync, readFileSync } from "node:fs";
// A `.cmd` shim is a Windows artefact by definition, so its path is always win32-shaped. Pinning
// the win32 helpers keeps resolution correct — and testable — regardless of the host platform.
import { win32 as windowsPath } from "node:path";

/**
 * Matches the Node entry point inside an npm/pnpm/yarn `.cmd` shim.
 *
 * `cmd-shim` (used by all three) emits a final line of the form
 * `"%_prog%"  "%dp0%\..\pkg\cli.js" %*`, with `%dp0%` (or `%~dp0`) standing in for the shim's own
 * directory. Capturing that second quoted token gives the script the shim would have run.
 */
const SHIM_TARGET_REGEX = /"%~?dp0%?\\?([^"]+?\.[cm]?js)"/i;

/**
 * Extracts the script a `cmd-shim` runs, resolved against the shim's own directory.
 *
 * Pure, so the parsing can be tested without touching a filesystem or pretending to be Windows.
 * @param contents The shim's text.
 * @param shimPath Absolute path to the shim, used to resolve `%dp0%`.
 * @returns The absolute target path, or `undefined` when the shim does not follow the `cmd-shim`
 * layout (a hand-written batch file, or a wrapper around a native `.exe`).
 */
export const parseShimTarget = (contents: string, shimPath: string): string | undefined => {
    const relativeTarget = SHIM_TARGET_REGEX.exec(contents)?.[1];

    if (relativeTarget === undefined) {
        return undefined;
    }

    // `%dp0%` expands to the shim's directory with a trailing separator; the captured remainder is
    // relative to it and may walk upwards (`..\..\pkg\cli.js`).
    return windowsPath.resolve(windowsPath.dirname(shimPath), relativeTarget);
};

/**
 * Resolves an npm-style Windows `.cmd`/`.bat` shim to the JavaScript file it executes.
 *
 * Running the shim requires `cmd.exe`, and a `cmd.exe` command line offers no way to escape `%`:
 * `%VAR%` in any argument is expanded before the target program sees it, substituting environment
 * values into the argument (see qntm.org/cmd, and the same gap in `cross-spawn`'s escaping). There
 * is no quoting fix — the only remedy is not to involve `cmd.exe`. Resolving the shim lets the
 * caller spawn the interpreter directly, with arguments passed as an argv array no shell parses.
 * @param shimPath Absolute path to the `.cmd`/`.bat` shim.
 * @returns The target script, or `undefined` when the shim is unreadable, is not a `cmd-shim`, or
 * names a script that is no longer on disk.
 */
export const resolveWindowsShimTarget = (shimPath: string): string | undefined => {
    let contents: string;

    try {
        contents = readFileSync(shimPath, "utf8");
    } catch {
        return undefined;
    }

    const target = parseShimTarget(contents, shimPath);

    if (target === undefined) {
        return undefined;
    }

    // A stale shim left behind after its package was removed must fall back, not spawn a missing
    // file.
    return existsSync(target) ? target : undefined;
};

/**
 * Picks the Node binary a shim would have used.
 *
 * `cmd-shim` prefers a `node.exe` sitting next to the shim and only falls back to `node` on PATH.
 * Honouring that matters in two real setups: under nvm-windows or Volta the neighbouring binary can
 * be a different Node major, and when this library is embedded in an Electron host
 * `process.execPath` is the Electron binary, which would launch the app instead of running the
 * script.
 * @param shimPath Absolute path to the shim.
 * @returns The interpreter to spawn.
 */
export const resolveShimInterpreter = (shimPath: string): string => {
    const neighbour = windowsPath.join(windowsPath.dirname(shimPath), "node.exe");

    return existsSync(neighbour) ? neighbour : process.execPath;
};
