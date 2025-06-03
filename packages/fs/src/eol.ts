import { platform } from "node:process";

const regDetect = /\r?\n/g;

/** End-of-line character for POSIX platforms such as macOS and Linux. */
export const LF = "\n" as const;

/** End-of-line character for Windows platforms. */
export const CRLF = "\r\n" as const;

/**
 * End-of-line character evaluated for the current platform.
 */
export const EOL: "\n" | "\r\n" = platform === "win32" ? CRLF : LF;

/**
 * Detect the EOL character for string input.
 * Returns null if no newline.
 * @param content The string content to detect the EOL from.
 * @example
 * ```javascript
 * import { detect } from "@visulima/fs/eol";
 *
 * detect("Hello\r\nWorld"); // "\r\n"
 * detect("Hello\nWorld"); // "\n"
 * detect("HelloWorld"); // null
 * ```
 */
export const detect = (content: string): typeof EOL | null => {
    const matched = content.match(regDetect);

    if (!matched || matched.length === 0) {
        return null;
    }

    const crlf = matched.filter((newline) => newline === CRLF).length;
    const lf = matched.length - crlf;

    return crlf > lf ? CRLF : LF;
};

/**
 * Format the file to the targeted EOL.
 * @param content The string content to format.
 * @param eol The target EOL character.
 * @example
 * ```javascript
 * import { format, LF, CRLF } from "@visulima/fs/eol";
 *
 * format("Hello\r\nWorld\nUnix", LF); // "Hello\nWorld\nUnix"
 * format("Hello\nWorld\r\nWindows", CRLF); // "Hello\r\nWorld\r\nWindows"
 * ```
 */
export const format = (content: string, eol: typeof EOL): string => content.replaceAll(regDetect, eol);
