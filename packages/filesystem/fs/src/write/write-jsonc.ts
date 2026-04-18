import { readFile } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessible from "../is-accessible";
import type { WriteJsoncOptions } from "../types";
import { buildJsoncOutput } from "../utils/jsonc-merge";
import writeFile from "./write-file";

const readExisting = async (
    path: URL | string,
    detectIndent: boolean | undefined,
    fallbackIndent: number | string,
): Promise<{ existingText?: string; indent: number | string; trailingNewline: string }> => {
    let existingText: string | undefined;
    let indent = fallbackIndent;
    let trailingNewline = "\n";

    const accessible = await isAccessible(path, R_OK);

    if (!accessible) {
        return { indent, trailingNewline };
    }

    try {
        existingText = await readFile(path, "utf8");

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
 * Asynchronously writes a value to a JSONC file. When `preserveComments` is `true` (the default)
 * and the target file already exists, existing comments and formatting are preserved by computing
 * a minimal diff against the new value via `jsonc-parser`'s `modify` API.
 * @param path The path to the JSONC file. Can be a file URL or a string path.
 * @param data The data to serialize.
 * @param options Optional configuration. See {@link WriteJsoncOptions}.
 * @returns A promise that resolves when the file has been written.
 * @example
 * ```javascript
 * import { writeJsonc } from "@visulima/fs/jsonc";
 *
 * // Preserves comments inside an existing tsconfig.json
 * await writeJsonc("./tsconfig.json", { ...tsconfig, compilerOptions: { target: "es2024" } });
 * ```
 */
const writeJsonc = async (path: URL | string, data: unknown, options: WriteJsoncOptions = {}): Promise<void> => {
    const { detectIndent, formattingOptions, indent: indentOption, preserveComments = true, replacer, ...writeOptions } = { indent: "\t", ...options };

    const { existingText, indent, trailingNewline } = await readExisting(path, detectIndent, indentOption);
    const output = buildJsoncOutput(existingText, data, preserveComments, indent, trailingNewline, formattingOptions, replacer);

    await writeFile(path, output, writeOptions);
};

export default writeJsonc;
