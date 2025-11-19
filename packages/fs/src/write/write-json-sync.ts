import { readFileSync } from "node:fs";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteJsonOptions } from "../types";
import writeFileSync from "./write-file-sync";

/**
 * Synchronously writes an object to a JSON file.
 * Handles indentation detection, custom stringifiers, and gracefully manages existing files.
 * @param path The path to the JSON file to write. Can be a file URL or a string path.
 * @param data The data to serialize and write. Can be any JavaScript value that can be stringified by `JSON.stringify` or a custom stringifier.
 * @param options Optional configuration for writing the JSON file. See {@link WriteJsonOptions}.
 * @example
 * ```javascript
 * import { writeJsonSync } from "@visulima/fs";
 * import { join } from "node:path";
 *
 * const writeMyJsonSync = () => {
 *   try {
 *     writeJsonSync(join("/tmp", "my-config-sync.json"), { setting: "enabled", value: 456 });
 *     console.log("JSON file written successfully (sync).");
 *
 *     writeJsonSync(join("/tmp", "another-config-sync.json"), { user: "testSync", id: "def" }, { indent: 4, replacer: ["id"] });
 *     console.log("Another JSON file written with specific options (sync, indent 4, only 'id' key).");
 *   } catch (error) {
 *     console.error("Failed to write JSON file (sync):", error);
 *   }
 * };
 *
 * writeMyJsonSync();
 * ```
 */
const writeJsonSync = (path: URL | string, data: unknown, options: WriteJsonOptions = {}): void => {
    const { detectIndent, indent: indentOption, replacer, stringify = JSON.stringify, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (isAccessibleSync(path, R_OK)) {
        try {
            const file = readFileSync(path, "utf8");

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

    writeFileSync(path, `${json}${trailingNewline}`, writeOptions);
};

export default writeJsonSync;
