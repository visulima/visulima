import { readFile } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";
import JSON5 from "json5";

import { R_OK } from "../constants";
import isAccessible from "../is-accessible";
import type { WriteJson5Options } from "../types";
import writeFile from "./write-file";

/**
 * Asynchronously writes a value to a JSON5 file.
 * @param path The path to the JSON5 file. Can be a file URL or a string path.
 * @param data The data to serialize.
 * @param options Optional configuration. See {@link WriteJson5Options}.
 * @returns A promise that resolves when the file has been written.
 * @example
 * ```javascript
 * import { writeJson5 } from "@visulima/fs/json5";
 *
 * await writeJson5("./config.json5", { name: "app" }, { indent: 2, quote: "'" });
 * ```
 */
const writeJson5 = async (path: URL | string, data: unknown, options: WriteJson5Options = {}): Promise<void> => {
    const { detectIndent, indent: indentOption, quote, replacer, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (await isAccessible(path, R_OK)) {
        try {
            const file = await readFile(path, "utf8");

            if (detectIndent) {
                const { indent: detectedIndent } = detectIndentFn(file);

                if (detectedIndent) {
                    indent = detectedIndent;
                }
            }

            trailingNewline = file.endsWith("\n") ? "\n" : "";
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = JSON5.stringify(data, { quote, replacer: replacer as any, space: indent });

    await writeFile(path, `${output}${trailingNewline}`, writeOptions);
};

export default writeJson5;
