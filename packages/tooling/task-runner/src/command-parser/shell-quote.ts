/**
 * Wraps a value so it can be spliced into a shell command line on either
 * POSIX `sh` or Windows `cmd.exe`.
 *
 * Strategy: if the value contains only characters that are inert under
 * both shells (alphanumerics, `_`, `-`, `.`, `/`, `:`, `@`, `+`, `,`, `=`),
 * it is returned verbatim. Adding quotes around safe values would survive
 * `sh -c` (which strips them) but leak into `argv` on Windows — `cmd.exe`
 * does not strip single quotes, so file paths showed up as `'src/a.ts'`
 * in the child process.
 *
 * Anything that needs quoting branches by platform: POSIX uses single
 * quotes (with `'\''` for embedded single quotes); Windows wraps in
 * double quotes and escapes the cmd meta-characters that survive inside
 * `"..."` (`^`, `&`, `|`, `<`, `>`) plus embedded double quotes per the
 * MS CRT convention (`\"`).
 */
const SAFE_FOR_BOTH_SHELLS = /^[\w./:@+,=-]+$/;

export const shellQuote = (value: string): string => {
    if (value !== "" && SAFE_FOR_BOTH_SHELLS.test(value)) {
        return value;
    }

    if (process.platform === "win32") {
        return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll(/[\^&|<>]/g, "^$&")}"`;
    }

    return `'${value.replaceAll("'", String.raw`'\''`)}'`;
};
