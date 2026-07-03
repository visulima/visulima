import { readFileSync } from "node:fs";

import { parse, stringify } from "ini";

import { R_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { IniEncodeOptions, WriteIniOptions } from "../types";
import { detectIniStyle, mergeIniPreservingLines } from "../utils/ini-preserve";
import writeFileSync from "./write-file-sync";

/**
 * Synchronously writes an object to an INI file.
 *
 * When an existing file is present and `preserveStyle` is `true` (the default), the original file's
 * whitespace-around-`=` style and line endings are auto-detected and retained, and any line whose
 * parsed value is unchanged is kept verbatim — preserving trailing whitespace and inline `;`/`#`
 * comments. Explicit `whitespace` / `eol` options always win over detection.
 * @param path The path to the INI file. Can be a file URL or a string path.
 * @param data The data to serialize.
 * @param options Optional configuration. See {@link WriteIniOptions}.
 * @example
 * ```javascript
 * import { writeIniSync } from "@visulima/fs/ini";
 *
 * writeIniSync("./config.ini", { server: { port: 8080 } });
 * ```
 */
const writeIniSync = (path: URL | string, data: Record<string, unknown>, options: WriteIniOptions = {}): void => {
    const { eol, preserveStyle = true, whitespace, ...rest } = options;
    const { align, bracketedArray, newline, platform, section, sort, ...writeOptions } = rest;

    let resolvedEol = eol;
    let resolvedWhitespace = whitespace;
    let existingText: string | undefined;
    let oldData: Record<string, unknown> | undefined;

    if (preserveStyle && isAccessibleSync(path, R_OK)) {
        try {
            existingText = readFileSync(path, "utf8");
            oldData = parse(existingText, { bracketedArray: bracketedArray ?? true });

            const detected = detectIniStyle(existingText);

            resolvedEol ??= detected.eol;
            resolvedWhitespace ??= detected.whitespace;
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }
    }

    const encodeOptions: IniEncodeOptions = { align, bracketedArray, newline, platform, section, sort, whitespace: resolvedWhitespace };
    const freshStringify = (value: Record<string, unknown>, sectionName?: string): string =>
        stringify(value, sectionName === undefined ? encodeOptions : { ...encodeOptions, section: sectionName });

    let output: string;

    if (existingText !== undefined && oldData) {
        output = mergeIniPreservingLines(existingText, oldData, data, freshStringify, {
            eol: resolvedEol ?? "\n",
            whitespace: resolvedWhitespace ?? false,
        });
    } else {
        output = freshStringify(data, section);

        if (resolvedEol === "\r\n") {
            output = output.replaceAll(/\r?\n/g, "\r\n");
        }
    }

    writeFileSync(path, output, writeOptions);
};

export default writeIniSync;
