/**
 * Path helpers shared by the formatter adapters. Tools emit file paths that
 * are sometimes relative to the workspace root and sometimes already
 * absolute; these normalize them to absolute paths so every downstream
 * `Finding.file` is absolute on every platform.
 */

/**
 * True when `raw` is already an absolute path — a POSIX root (`/foo`) or a
 * Windows drive-qualified path (`C:\foo` or `C:/foo`).
 * @param raw Path token to test.
 * @returns Whether the path is absolute.
 */
export const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

/**
 * Resolve a tool-emitted path against the workspace `root`. Absolute paths
 * (POSIX or Windows) are returned unchanged; relative paths are joined under
 * `root`.
 * @param root Absolute workspace root the tool ran in.
 * @param line Path token emitted by the tool.
 * @returns An absolute path.
 */
export const resolveFile = (root: string, line: string): string => (isAbsolutePath(line) ? line : `${root}/${line}`);
