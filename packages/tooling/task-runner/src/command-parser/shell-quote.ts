/**
 * Shell-escapes a string by wrapping it in single quotes. Embedded single
 * quotes are emitted as `'\''` (close, escape, reopen) so the result is safe
 * to splice into POSIX shell command lines without any other escaping.
 */
export const shellQuote = (value: string): string => `'${value.replaceAll("'", String.raw`'\''`)}'`;
