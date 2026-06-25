import { BEL, OSC } from "./constants";

/**
 * Returns a sequence that reports the current working directory to the terminal.
 *
 * Terminals such as iTerm2, WezTerm and others use this `OSC 7` sequence to keep
 * track of the shell's working directory — for example to open new tabs/splits in
 * the same directory. The payload is a `file://` URL built from the optional
 * `host` and the joined `paths`.
 *
 * Sequence: `OSC 7 ; file://[host]/[path] BEL`
 * @param host The host portion of the `file://` URL (use an empty string for the local machine).
 * @param paths One or more path segments that are joined into the URL path.
 * @returns The `OSC 7` escape sequence.
 * @example
 * ```typescript
 * import { notifyWorkingDirectory } from "@visulima/ansi/cwd";
 *
 * process.stdout.write(notifyWorkingDirectory("", process.cwd()));
 * ```
 * @see {@link https://gitlab.freedesktop.org/terminal-wg/specifications/-/issues/20}
 */
export const notifyWorkingDirectory = (host: string, ...paths: string[]): string => {
    const joined = paths
        .filter((part) => part.length > 0)
        .join("/")
        .replaceAll(/\/{2,}/g, "/");

    const path = joined.startsWith("/") ? joined : `/${joined}`;

    // `encodeURI` already neutralizes control bytes in the path; strip them from the host too so it cannot inject escape sequences.
    // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
    const safeHost = host.replaceAll(/[\u0007\u001B]/g, "");

    return `${OSC}7;file://${safeHost}${encodeURI(path)}${BEL}`;
};

/**
 * Alias for {@link notifyWorkingDirectory}.
 */
export const setWorkingDirectory: (host: string, ...paths: string[]) => string = notifyWorkingDirectory;
