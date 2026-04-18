import { readFileSync } from "node:fs";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteJsoncOptions } from "../types";
import { buildJsoncOutput } from "../utils/jsonc-merge";
import writeFileSync from "./write-file-sync";

const readExistingSync = (
    path: URL | string,
    detectIndent: boolean | undefined,
    fallbackIndent: number | string,
): { existingText?: string; indent: number | string; trailingNewline: string } => {
    let existingText: string | undefined;
    let indent = fallbackIndent;
    let trailingNewline = "\n";

    if (!isAccessibleSync(path, R_OK)) {
        return { indent, trailingNewline };
    }

    try {
        existingText = readFileSync(path, "utf8");

        if (detectIndent) {
            const { indent: detectedIndent } = detectIndentFn(existingText);

            if (detectedIndent) {
                indent = detectedIndent;
            }
        }

        trailingNewline = existingText.endsWith("\n") ? "\n" : "";
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    return { existingText, indent, trailingNewline };
};

/**
 * Synchronously writes a value to a JSONC file. When `preserveComments` is `true` (the default)
 * and the target file already exists, existing comments and formatting are preserved by computing
 * a minimal diff against the new value via `jsonc-parser`'s `modify` API.
 * @param path The path to the JSONC file. Can be a file URL or a string path.
 * @param data The data to serialize.
 * @param options Optional configuration. See {@link WriteJsoncOptions}.
 * @example
 * ```javascript
 * import { writeJsoncSync } from "@visulima/fs/jsonc";
 *
 * writeJsoncSync("./tsconfig.json", updated);
 * ```
 */
const writeJsoncSync = (path: URL | string, data: unknown, options: WriteJsoncOptions = {}): void => {
    const { detectIndent, formattingOptions, indent: indentOption, preserveComments = true, replacer, ...writeOptions } = { indent: "\t", ...options };

    const { existingText, indent, trailingNewline } = readExistingSync(path, detectIndent, indentOption);
    const output = buildJsoncOutput(existingText, data, preserveComments, indent, trailingNewline, formattingOptions, replacer);

    writeFileSync(path, output, writeOptions);
};

export default writeJsoncSync;
