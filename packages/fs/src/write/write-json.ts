import { readFile } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessible from "../is-accessible";
import type { WriteJsonOptions } from "../types";
import writeFile from "./write-file";

/**
 * Asynchronously writes an object to a JSON file.
 * Handles indentation detection, custom stringifiers, and gracefully manages existing files.
 * @param path The path to the JSON file to write. Can be a file URL or a string path.
 * @param data The data to serialize and write. Can be any JavaScript value that can be stringified by `JSON.stringify` or a custom stringifier.
 * @param options Optional configuration for writing the JSON file. See {@link WriteJsonOptions}.
 * @returns A promise that resolves when the JSON file has been written.
 * @example
 * ```javascript
 * import { writeJson } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyJson = async () => {
 *   try {
 *     await writeJson(join("/tmp", "my-config.json"), { setting: "enabled", value: 123 });
 *     console.log("JSON file written successfully.");
 *
 *     await writeJson(join("/tmp", "another-config.json"), { user: "test", id: "abc" }, { indent: 2, replacer: ["user"] });
 *     console.log("Another JSON file written with specific options (indent 2, only 'user' key).");
 *   } catch (error) {
 *     console.error("Failed to write JSON file:", error);
 *   }
 * };
 *
 * writeMyJson();
 * ```
 */
const writeJson = async (path: URL | string, data: unknown, options: WriteJsonOptions = {}): Promise<void> => {
    const { detectIndent, indent: indentOption, replacer, stringify = JSON.stringify, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (await isAccessible(path, R_OK)) {
        try {
            const file = await readFile(path, "utf8");

            if (detectIndent) {
                const { indent: dIndent } = detectIndentFn(file);

                indent = dIndent as string;
            }

            trailingNewline = file.endsWith("\n") ? "\n" : "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }

    // @ts-expect-error - `replacer` is a valid argument for `JSON.stringify`
    const json = stringify(data, replacer, indent);

    await writeFile(path, `${json}${trailingNewline}`, writeOptions);
};

export default writeJson;
